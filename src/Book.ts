import { Types } from "mongoose";
import {
  JournalAlreadyVoidedError,
  MediciError,
  ConsistencyError,
  JournalNotFoundError,
  BookConstructorError,
} from "./errors";
import { handleVoidMemo } from "./helper/handleVoidMemo";
import { addReversedTransactions } from "./helper/addReversedTransactions";
import { IPaginationQuery, IFilterQuery, parseFilterQuery } from "./helper/parse/parseFilterQuery";
import { IBalanceQuery, parseBalanceQuery } from "./helper/parse/parseBalanceQuery";
import { Entry } from "./Entry";
import { IJournal, journalModel } from "./models/journal";
import { ITransaction, transactionModel } from "./models/transaction";
import type { IOptions } from "./IOptions";
import { lockModel } from "./models/lock";
import {
  getBestBalanceSnapshot,
  getBestListAccountsSnapshot,
  IBalance,
  snapshotBalance,
  snapshotListAccounts,
} from "./models/balance";
import { IFilter } from "./helper/parse/IFilter";

const GROUP = {
  $group: {
    _id: null,
    balance: { $sum: { $subtract: ["$credit", "$debit"] } },
    notes: { $sum: 1 },
    lastTransactionId: { $max: "$_id" },
  },
};

function fromDistinctToAccounts(distinctResult: string[]) {
  const accountsSet: Set<string> = new Set();
  for (const result of distinctResult) {
    const prev: string[] = [];
    const paths: string[] = result.split(":");
    for (const acct of paths) {
      prev.push(acct);
      accountsSet.add(prev.join(":"));
    }
  }

  return Array.from(accountsSet);
}

export class Book<U extends ITransaction = ITransaction, J extends IJournal = IJournal> {
  name: string;
  precision: number;
  maxAccountPath: number;
  balanceSnapshotSec: number;
  expireBalanceSnapshotSec: number;

  constructor(
    name: string,
    options = {} as {
      precision?: number;
      maxAccountPath?: number;
      balanceSnapshotSec?: number;
      expireBalanceSnapshotSec?: number;
    }
  ) {
    this.name = name;
    this.precision = options.precision != null ? options.precision : 8;
    this.maxAccountPath = options.maxAccountPath != null ? options.maxAccountPath : 3;
    this.balanceSnapshotSec = options.balanceSnapshotSec != null ? options.balanceSnapshotSec : 24 * 60 * 60;
    this.expireBalanceSnapshotSec =
      options.expireBalanceSnapshotSec != null ? options.expireBalanceSnapshotSec : 2 * this.balanceSnapshotSec;

    if (typeof this.name !== "string" || this.name.trim().length === 0) {
      throw new BookConstructorError("Invalid value for name provided.");
    }

    if (typeof this.precision !== "number" || !Number.isInteger(this.precision) || this.precision < 0) {
      throw new BookConstructorError("Invalid value for precision provided.");
    }

    if (typeof this.maxAccountPath !== "number" || !Number.isInteger(this.maxAccountPath) || this.maxAccountPath < 0) {
      throw new BookConstructorError("Invalid value for maxAccountPath provided.");
    }

    if (typeof this.balanceSnapshotSec !== "number" || this.balanceSnapshotSec < 0) {
      throw new BookConstructorError("Invalid value for balanceSnapshotSec provided.");
    }

    if (typeof this.expireBalanceSnapshotSec !== "number" || this.expireBalanceSnapshotSec < 0) {
      throw new BookConstructorError("Invalid value for expireBalanceSnapshotSec provided.");
    }
  }

  entry(memo: string, date = null as Date | null, original_journal?: string | Types.ObjectId): Entry<U, J> {
    return Entry.write<U, J>(this, memo, date, original_journal);
  }

  async balance(query: IBalanceQuery, options = {} as IOptions): Promise<{ balance: number; notes: number }> {
    // If there is a session, we must NOT set any readPreference (as per mongo v5 and v6).
    // https://www.mongodb.com/docs/v6.0/core/transactions/#read-concern-write-concern-read-preference
    // Otherwise, we are free to use any readPreference.
    if (options && !options.session && !options.readPreference) {
      // Let's try reading from the secondary node, if available.
      options.readPreference = "secondaryPreferred";
    }

    const parsedQuery = parseBalanceQuery(query, this);
    const meta = parsedQuery.meta;
    delete parsedQuery.meta;

    let balanceSnapshot: IBalance | null = null;
    let accountForBalanceSnapshot: string | undefined;
    if (this.balanceSnapshotSec) {
      accountForBalanceSnapshot = query.account ? [].concat(query.account as never).join() : undefined;
      balanceSnapshot = await getBestBalanceSnapshot(
        {
          book: parsedQuery.book,
          account: accountForBalanceSnapshot,
          meta,
        },
        options
      );
      if (balanceSnapshot) {
        // Use cached balance
        parsedQuery._id = { $gt: balanceSnapshot.transaction };
      }
    }

    const match = { $match: parsedQuery };

    const result = (await transactionModel.collection.aggregate([match, GROUP], options).toArray())[0];

    let balance = 0;
    let notes = 0;

    if (balanceSnapshot) {
      balance += balanceSnapshot.balance;
      notes += balanceSnapshot.notes;
    }

    if (result) {
      balance += parseFloat(result.balance.toFixed(this.precision));
      notes += result.notes;

      // We can do snapshots only if there is at least one entry for this balance
      if (this.balanceSnapshotSec && result.lastTransactionId) {
        // It's the first (ever?) snapshot for this balance. We just need to save whatever we've just aggregated
        // so that the very next balance query would use cached snapshot.
        if (!balanceSnapshot) {
          await snapshotBalance(
            {
              book: this.name,
              account: accountForBalanceSnapshot,
              meta,
              transaction: result.lastTransactionId,
              balance,
              notes,
              expireInSec: this.expireBalanceSnapshotSec,
            } as IBalance & { expireInSec: number },
            options
          );
        } else {
          // There is a snapshot already. But let's check if it's too old.
          const tooOld = Date.now() > balanceSnapshot.createdAt.getTime() + this.balanceSnapshotSec * 1000;
          // If it's too old we would need to cache another snapshot.
          if (tooOld) {
            delete parsedQuery._id;
            const match = { $match: parsedQuery };

            // Important! We are going to recalculate the entire balance from the day one.
            // Since this operation can take seconds (if you have millions of documents)
            // we better run this query IN THE BACKGROUND.
            // If this exact balance query would be executed multiple times at the same second we might end up with
            // multiple snapshots in the database. Which is fine. The chance of this happening is low.
            // Our main goal here is not to delay this .balance() method call. The tradeoff is that
            // database will use 100% CPU for few (milli)seconds, which is fine. It's all fine (C)
            transactionModel.collection
              .aggregate([match, GROUP], options)
              .toArray()
              .then((results) => {
                const resultFull = results[0];
                return snapshotBalance(
                  {
                    book: this.name,
                    account: accountForBalanceSnapshot,
                    meta,
                    transaction: resultFull.lastTransactionId,
                    balance: parseFloat(resultFull.balance.toFixed(this.precision)),
                    notes: resultFull.notes,
                    expireInSec: this.expireBalanceSnapshotSec,
                  } as IBalance & { expireInSec: number },
                  options
                );
              })
              .catch((error) => {
                console.error("medici: Couldn't do background balance snapshot.", error);
              });
          }
        }
      }
    }

    return { balance, notes };
  }

  async ledger<T = U>(
    query: IFilterQuery & IPaginationQuery,
    options = {} as IOptions
  ): Promise<{ results: T[]; total: number }> {
    // Pagination
    const { perPage, page, ...restOfQuery } = query;
    const paginationOptions: { skip?: number; limit?: number } = {};
    if (typeof perPage === "number" && Number.isSafeInteger(perPage)) {
      paginationOptions.skip = (Number.isSafeInteger(page) ? (page as number) - 1 : 0) * perPage;
      paginationOptions.limit = perPage;
    }

    const filterQuery = parseFilterQuery(restOfQuery, this);
    const findPromise = transactionModel.collection
      .find(filterQuery, {
        ...paginationOptions,

        sort: {
          datetime: -1,
          timestamp: -1,
        },
        session: options.session,
      })
      .toArray();

    let countPromise = Promise.resolve(0);
    if (paginationOptions.limit) {
      countPromise = transactionModel.collection.countDocuments(filterQuery, { session: options.session });
    }

    const results = (await findPromise) as T[];

    return {
      results,
      total: (await countPromise) || results.length,
    };
  }

  async void(journal_id: string | Types.ObjectId, reason?: undefined | string, options = {} as IOptions) {
    journal_id = typeof journal_id === "string" ? new Types.ObjectId(journal_id) : journal_id;

    const journal = await journalModel.collection.findOne(
      {
        _id: journal_id,
        book: this.name,
      },
      {
        session: options.session,
        projection: {
          _id: true,
          _transactions: true,
          memo: true,
          void_reason: true,
          voided: true,
        },
      }
    );

    if (journal === null) {
      throw new JournalNotFoundError();
    }

    if (journal.voided) {
      throw new JournalAlreadyVoidedError();
    }

    reason = handleVoidMemo(reason, journal.memo);

    // Not using options.session here as this read operation is not necessary to be in the ACID session.
    const transactions = await transactionModel.collection.find({ _journal: journal._id }).toArray();

    if (transactions.length !== journal._transactions.length) {
      throw new MediciError(`Transactions for journal ${journal._id} not found on book ${journal.book}`);
    }

    const entry = this.entry(reason, null, journal_id);

    addReversedTransactions(entry, transactions as ITransaction[]);

    // Set this journal to void with reason and also set all associated transactions
    const resultOne = await journalModel.collection.updateOne(
      { _id: journal._id },
      { $set: { voided: true, void_reason: reason } },
      {
        session: options.session, // We must provide either session or writeConcern, but not both.
        writeConcern: options.session ? undefined : { w: 1, j: true }, // Ensure at least ONE node wrote to JOURNAL (disk)
      }
    );

    // This can happen if someone read a journal, then deleted it from DB, then tried voiding. Full stop.
    if (resultOne.matchedCount === 0)
      throw new ConsistencyError(`Failed to void ${journal.memo} ${journal._id} journal on book ${journal.book}`);
    // Someone else voided! Is it two simultaneous voidings? Let's stop our void action altogether.
    if (resultOne.modifiedCount === 0)
      throw new ConsistencyError(`Already voided ${journal.memo} ${journal._id} journal on book ${journal.book}`);

    const resultMany = await transactionModel.collection.updateMany(
      { _journal: journal._id },
      { $set: { voided: true, void_reason: reason } },
      {
        session: options.session, // We must provide either session or writeConcern, but not both.
        writeConcern: options.session ? undefined : { w: 1, j: true }, // Ensure at least ONE node wrote to JOURNAL (disk)
      }
    );

    // At this stage we have to make sure the `commit()` is executed.
    // Let's not make the DB even more inconsistent if something wild happens. Let's not throw, instead log to stderr.
    if (resultMany.matchedCount !== transactions.length)
      throw new ConsistencyError(
        `Failed to void all ${journal.memo} ${journal._id} journal transactions on book ${journal.book}`
      );
    if (resultMany.modifiedCount === 0)
      throw new ConsistencyError(
        `Already voided ${journal.memo} ${journal._id} journal transactions on book ${journal.book}`
      );

    return entry.commit(options);
  }

  async writelockAccounts(accounts: string[], options: Required<Pick<IOptions, "session">>): Promise<Book<U, J>> {
    accounts = Array.from(new Set(accounts));

    // ISBN: 978-1-4842-6879-7. MongoDB Performance Tuning (2021), p. 217
    // Reduce the Chance of Transient Transaction Errors by moving the
    // contentious statement to the end of the transaction.
    for (const account of accounts) {
      await lockModel.collection.updateOne(
        { account, book: this.name },
        {
          $set: { updatedAt: new Date() },
          $setOnInsert: { book: this.name, account },
          $inc: { __v: 1 },
        },
        { upsert: true, session: options.session }
      );
    }
    return this;
  }

  async listAccounts(options = {} as IOptions): Promise<string[]> {
    // If there is a session, we must NOT set any readPreference (as per mongo v5 and v6).
    // https://www.mongodb.com/docs/v6.0/core/transactions/#read-concern-write-concern-read-preference
    // Otherwise, we are free to use any readPreference.
    if (options && !options.session && !options.readPreference) {
      // Let's try reading from the secondary node, if available.
      options.readPreference = "secondaryPreferred";
    }

    const query = { book: this.name } as IFilter;

    let listAccountsSnapshot: IBalance | null = null;
    if (this.balanceSnapshotSec) {
      listAccountsSnapshot = await getBestListAccountsSnapshot({ book: this.name });
      if (listAccountsSnapshot) {
        // Use cached balance
        query.timestamp = { $gte: listAccountsSnapshot.createdAt };
      }
    }

    const createdAt = new Date(); // take date earlier
    const results = (await transactionModel.collection.distinct("accounts", query, {
      session: options.session,
    })) as string[];

    let uniqueAccounts = fromDistinctToAccounts(results);

    if (listAccountsSnapshot) {
      uniqueAccounts = Array.from(new Set([...uniqueAccounts, ...listAccountsSnapshot.meta.accounts]));
    }

    if (uniqueAccounts.length === 0) return uniqueAccounts;

    if (this.balanceSnapshotSec) {
      // It's the first (ever?) snapshot for this listAccounts. We just need to save whatever we've just aggregated
      // so that the very next listAccounts query would use cached snapshot.
      if (!listAccountsSnapshot) {
        await snapshotListAccounts({
          book: this.name,
          accounts: uniqueAccounts,
          createdAt,
          expireInSec: this.expireBalanceSnapshotSec,
        });
      } else {
        // There is a snapshot already. But let's check if it's too old.
        const tooOld = Date.now() > listAccountsSnapshot.createdAt.getTime() + this.balanceSnapshotSec * 1000;
        // If it's too old we would need to cache another snapshot.
        if (tooOld) {
          delete query.timestamp;

          // Important! We are going to recalculate the entire listAccounts from the day one.
          // Since this operation can take seconds (if you have millions of documents)
          // we better run this query IN THE BACKGROUND.
          // If this exact balance query would be executed multiple times at the same second we might end up with
          // multiple snapshots in the database. Which is fine. The chance of this happening is low.
          // Our main goal here is not to delay this .listAccounts() method call. The tradeoff is that
          // database will use 100% CPU for few (milli)seconds, which is fine. It's all fine (C)
          transactionModel.collection
            .distinct("accounts", query, {
              session: options.session,
            })
            .then((results) => {
              return snapshotListAccounts({
                book: this.name,
                accounts: fromDistinctToAccounts(results),
                createdAt,
                expireInSec: this.expireBalanceSnapshotSec,
              });
            })
            .catch((error) => {
              console.error("medici: Couldn't do background listAccounts snapshot.", error);
            });
        }
      }
    }

    return uniqueAccounts;
  }
}

export default Book;

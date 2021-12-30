import { Types } from "mongoose";
import type { Book } from "./Book";
import { isValidTransactionKey, ITransaction, transactionModel } from "./models/transaction";
import { TransactionError } from "./errors/TransactionError";
import { IJournal, journalModel, TJournalDocument } from "./models/journal";
import { isPrototypeAttribute } from "./helper/isPrototypeAttribute";
import type { IOptions } from "./IOptions";
import type { IAnyObject } from "./IAnyObject";
import { InvalidAccountPathLengthError } from "./errors/InvalidAccountPathLengthError";
import { parseDateField } from "./helper/parse/parseDateField";

export class Entry<U extends ITransaction = ITransaction, J extends IJournal = IJournal> {
  book: Book;
  journal: TJournalDocument<J> & { _original_journal?: Types.ObjectId };
  transactions: U[] = [];

  static write<U extends ITransaction, J extends IJournal>(
    book: Book,
    memo: string,
    date: Date | null,
    original_journal?: string | Types.ObjectId
  ): Entry<U, J> {
    return new this(book, memo, date, original_journal);
  }

  constructor(book: Book, memo: string, date: Date | null, original_journal?: string | Types.ObjectId) {
    this.book = book;
    this.journal = new journalModel() as TJournalDocument<J> & {
      _original_journal?: Types.ObjectId;
    };
    this.journal.memo = String(memo);

    if (original_journal) {
      this.journal._original_journal =
        typeof original_journal === "string" ? new Types.ObjectId(original_journal) : original_journal;
    }

    this.journal.datetime = parseDateField(date) || new Date();
    this.journal.book = this.book.name;
    this.transactions = [];
  }

  private transact(
    type: -1 | 1,
    account_path: string | string[],
    amount: number | string,
    extra: (Partial<U> & IAnyObject) | null
  ): Entry<U, J> {
    if (typeof account_path === "string") {
      account_path = account_path.split(":");
    }

    if (account_path.length > this.book.maxAccountPath) {
      throw new InvalidAccountPathLengthError(`Account path is too deep (maximum ${this.book.maxAccountPath})`);
    }

    amount = typeof amount === "string" ? parseFloat(amount) : amount;
    const credit = type === 1 ? amount : 0.0;
    const debit = type === -1 ? amount : 0.0;

    const transaction: ITransaction = {
      // _id: keys are generated on the database side for better consistency
      _journal: this.journal._id,
      account_path,
      accounts: account_path.join(":"),
      book: this.book.name,
      credit,
      datetime: this.journal.datetime,
      debit,
      memo: this.journal.memo,
      timestamp: new Date(),
    };
    if (this.journal._original_journal) {
      transaction._original_journal = this.journal._original_journal;
    }

    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        if (isPrototypeAttribute(key)) continue;
        if (isValidTransactionKey(key)) {
          transaction[key] = value as never;
        } else {
          if (!transaction.meta) transaction.meta = {};
          transaction.meta[key] = value;
        }
      }
    }
    this.transactions.push(transaction as U);

    return this;
  }

  credit<T extends IAnyObject = IAnyObject>(
    account_path: string | string[],
    amount: number | string,
    extra = null as (T & Partial<U>) | null
  ): Entry<U, J> {
    return this.transact(1, account_path, amount, extra);
  }

  debit<T extends IAnyObject = IAnyObject>(
    account_path: string | string[],
    amount: number | string,
    extra = null as (T & Partial<U>) | null
  ): Entry<U, J> {
    return this.transact(-1, account_path, amount, extra);
  }

  async commit(options = {} as IOptions & { writelockAccounts?: string[] | RegExp }): Promise<Entry<U, J>["journal"]> {
    let total = 0.0;
    for (const tx of this.transactions) {
      // sum the value of the transaction
      total += tx.credit - tx.debit;
    }

    total = parseFloat(total.toFixed(this.book.precision));

    if (total !== 0) {
      throw new TransactionError("INVALID_JOURNAL: can't commit non zero total", total);
    }

    try {
      const result = await transactionModel.collection.insertMany(this.transactions, {
        forceServerObjectId: true, // This improves ordering of the entries on high load.
        ordered: true, // Ensure items are inserted in the order provided.
        session: options.session, // We must provide either session or writeConcern, but not both.
        writeConcern: options.session ? undefined : { w: 1, j: true }, // Ensure at least ONE node wrote to JOURNAL (disk)
      });
      let insertedIds = Object.values(result.insertedIds) as Types.ObjectId[];

      if (insertedIds.length !== this.transactions.length) {
        throw new TransactionError(
          `Saved only ${insertedIds.length} of ${this.transactions.length} transactions`,
          total
        );
      }

      if (!insertedIds[0]) {
        // Mongo returns `undefined` as the insertedIds when forceServerObjectId=true. Let's re-read it.
        const txs = await transactionModel.collection
          .find({ _journal: this.transactions[0]._journal }, { projection: { _id: 1 }, session: options.session })
          .toArray();
        insertedIds = txs.map((tx) => tx._id as Types.ObjectId);
      }

      this.journal._transactions = insertedIds as Types.ObjectId[];
      await this.journal.save(options);

      if (options.writelockAccounts && options.session) {
        const writelockAccounts =
          options.writelockAccounts instanceof RegExp
            ? this.transactions
                .filter((tx) => (options.writelockAccounts as RegExp).test(tx.accounts))
                .map((tx) => tx.accounts)
            : options.writelockAccounts;

        await this.book.writelockAccounts(writelockAccounts, {
          session: options.session,
        });
      }

      return this.journal;
    } catch (err) {
      if (!options.session) {
        throw new TransactionError(`Failure to save journal: ${(err as Error).message}`, total);
      }
      throw err;
    }
  }
}

export default Entry;

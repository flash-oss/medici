import { Entry } from "./Entry";
import { IPaginationQuery, IParseQuery, parseQuery } from "./helper/parseQuery";
import { IJournal, journalModel } from "./models/journal";
import { isValidTransactionKey, ITransaction, transactionModel } from "./models/transaction";
import type { IOptions } from "./IOptions";
import type { Document, Types } from "mongoose";
import { JournalNotFoundError } from "./errors/JournalNotFoundError";
import { BookConstructorError } from "./errors/BookConstructorError";
import { lockModel } from "./models/lock";

export class Book<U extends ITransaction = ITransaction, J extends IJournal = IJournal> {
  name: string;
  precision: number;
  maxAccountPath: number;

  constructor(name: string, options = {} as { precision?: number; maxAccountPath?: number }) {
    this.name = name;
    this.precision = options.precision != null ? options.precision : 8;
    this.maxAccountPath = options.maxAccountPath != null ? options.maxAccountPath : 3;

    if (typeof this.name !== "string" || this.name.trim().length === 0) {
      throw new BookConstructorError("Invalid value for name provided.");
    }

    if (typeof this.precision !== "number" || !Number.isInteger(this.precision) || this.precision < 0) {
      throw new BookConstructorError("Invalid value for precision provided.");
    }

    if (typeof this.maxAccountPath !== "number" || !Number.isInteger(this.maxAccountPath) || this.maxAccountPath < 0) {
      throw new BookConstructorError("Invalid value for maxAccountPath provided.");
    }
  }

  entry(memo: string, date = null as Date | null, original_journal?: string | Types.ObjectId): Entry<U, J> {
    return Entry.write<U, J>(this, memo, date, original_journal);
  }

  async balance(query: IParseQuery, options = {} as IOptions): Promise<{ balance: number; notes: number }> {
    const match = {
      $match: parseQuery(query, this),
    };

    const group = {
      $group: {
        _id: null,
        balance: {
          $sum: {
            $subtract: ["$credit", "$debit"],
          },
        },
        count: {
          $sum: 1,
        },
      },
    };
    const result = (await transactionModel.aggregate([match, group], options).exec())[0];
    return !result
      ? {
          balance: 0,
          notes: 0,
        }
      : {
          balance: parseFloat(result.balance.toFixed(this.precision)),
          notes: result.count,
        };
  }

  async ledger<T = U>(
    query: IParseQuery & IPaginationQuery,
    populate?: string[] | null,
    options?: IOptions & { lean?: true }
  ): Promise<{ results: T[]; total: number }>;

  async ledger<T = U>(
    query: IParseQuery & IPaginationQuery,
    populate?: string[] | null,
    options?: IOptions & { lean?: false }
  ): Promise<{ results: (Document & T)[]; total: number }>;

  async ledger<T = U>(
    query: IParseQuery & IPaginationQuery,
    populate = null as string[] | null,
    options = {} as IOptions & { lean?: boolean }
  ): Promise<{ results: T[]; total: number }> {
    let skip;
    let limit = 0;

    const { lean = true } = options;

    // Pagination
    if (query.perPage) {
      skip = (query.page ? query.page - 1 : 0) * query.perPage;
      limit = query.perPage;
      delete query.perPage;
      delete query.page;
    }
    const filterQuery = parseQuery(query, this);
    const q = transactionModel.find(filterQuery, undefined, options).lean(lean).sort({
      datetime: -1,
      timestamp: -1,
    });

    let count = Promise.resolve(0);
    if (skip) {
      count = transactionModel
        .countDocuments(filterQuery)
        .session(options.session || null)
        .exec();
      q.skip(skip).limit(limit);
    }

    if (populate) {
      for (const p of populate) {
        if (isValidTransactionKey<U>(p)) {
          q.populate(p);
        }
      }
    }

    const results = (await q.exec()) as unknown as T[];

    return {
      results,
      total: (await count) || results.length,
    };
  }

  async void(journal_id: string | Types.ObjectId, reason?: undefined | string, options = {} as IOptions) {
    const journal = await journalModel
      .findOne(
        {
          _id: journal_id,
          book: this.name,
        },
        undefined,
        options
      )
      .exec();

    if (journal === null) {
      throw new JournalNotFoundError();
    }

    return journal.void(this, reason, options);
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
    const results = await transactionModel
      .find({ book: this.name }, undefined, options)
      .lean(true)
      .distinct("accounts")
      .exec();
    const uniqueAccounts: Set<string> = new Set();
    for (const result of results) {
      const prev = [];
      const paths = result.split(":");
      for (const acct of paths) {
        prev.push(acct);
        uniqueAccounts.add(prev.join(":"));
      }
    }
    return Array.from(uniqueAccounts);
  }
}

export default Book;

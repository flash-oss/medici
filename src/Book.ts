import { Entry } from "./Entry";
import { IPaginationQuery, IParseQuery, parseQuery } from "./helper/parseQuery";
import { IJournal, journalModel } from "./models/journals";
import {
  isValidTransactionKey,
  ITransaction,
  transactionModel,
} from "./models/transactions";
import type { IOptions } from "./IOptions";
import type { Document, PipelineStage, Types } from "mongoose";
import { JournalNotFoundError } from "./errors/JournalNotFoundError";
import { BookConstructorError } from "./errors/BookConstructorError";

export class Book<
  U extends ITransaction = ITransaction,
  J extends IJournal = IJournal
> {
  name: string;
  precision: number;
  maxAccountPath: number;

  constructor(
    name: string,
    options = {} as { precision?: number; maxAccountPath?: number }
  ) {
    this.name = name;
    this.precision =
      typeof options.precision !== "undefined" ? options.precision : 7;
    this.maxAccountPath =
      typeof options.maxAccountPath !== "undefined"
        ? options.maxAccountPath
        : 3;

    if (typeof this.name !== "string" || this.name.trim().length === 0) {
      throw new BookConstructorError("Invalid value for name provided.");
    }

    if (
      typeof this.precision !== "number" ||
      !Number.isInteger(this.precision) ||
      this.precision < 0
    ) {
      throw new BookConstructorError("Invalid value for precision provided.");
    }

    if (
      typeof this.maxAccountPath !== "number" ||
      !Number.isInteger(this.maxAccountPath) ||
      this.maxAccountPath < 0
    ) {
      throw new BookConstructorError(
        "Invalid value for maxAccountPath provided."
      );
    }
  }

  entry(
    memo: string,
    date = null as Date | null,
    original_journal = null as string | Types.ObjectId | null
  ): Entry<U, J> {
    return Entry.write<U, J>(this, memo, date, original_journal);
  }

  async balance(
    query: IParseQuery,
    options = {} as IOptions
  ): Promise<{ balance: number; notes: number }> {
    const match: PipelineStage.Match = {
      $match: parseQuery(query, this),
    };

    const group: PipelineStage.Group = {
      $group: {
        // https://github.com/Automattic/mongoose/pull/11104
        _id: null as any,
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
    const result = (
      await transactionModel.aggregate([match, group], options).exec()
    )[0];

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
    }
    const filterQuery = parseQuery(query, this);
    const q = transactionModel
      .find(filterQuery, undefined, options)
      .lean(lean)
      .sort({
        datetime: -1,
        timestamp: -1,
      });

    let count = Promise.resolve(0);
    if (typeof skip !== "undefined") {
      count = transactionModel
        .countDocuments(filterQuery)
        .session(options.session || null)
        .exec();
      q.skip(skip).limit(limit);
    }

    if (populate) {
      for (let i = 0, il = populate.length; i < il; i++) {
        if (isValidTransactionKey<U>(populate[i])) {
          q.populate(populate[i]);
        }
      }
    }

    const results = (await q.exec()) as unknown as T[];

    return {
      results,
      total: (await count) || results.length,
    };
  }

  async void(
    journal_id: string | Types.ObjectId,
    reason?: undefined | string,
    options = {} as IOptions
  ) {
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

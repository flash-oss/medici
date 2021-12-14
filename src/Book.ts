import { Entry } from "./Entry";
import { IParseQuery, parseQuery } from "./helper/parseQuery";
import { journalModel } from "./models/journals";
import { ITransaction, transactionModel } from "./models/transactions";
import type { IOptions } from "./IOptions";
import type { PipelineStage, Types } from "mongoose";

export class Book {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  entry(
    memo: string,
    date = null as Date | null,
    original_journal = null as Types.ObjectId | null
  ) {
    return Entry.write(this, memo, date, original_journal);
  }

  async balance(
    query: IParseQuery,
    options = {} as IOptions
  ): Promise<{ balance: number; notes: number }> {
    let skip: PipelineStage.Skip | undefined = undefined;

    if (query.perPage) {
      skip = { $skip: (query.page ? query.page - 1 : 0) * query.perPage };

      delete query.perPage;
      delete query.page;
    }
    const match: PipelineStage.Match = {
      $match: parseQuery(query, { name: this.name }),
    };

    const project: PipelineStage.Project = {
      $project: {
        debit: "$debit",
        credit: "$credit",
        datetime: "$datetime",
        timestamp: "$timestamp",
      },
    };
    const group: PipelineStage.Group = {
      $group: {
        _id: null as any,
        credit: {
          $sum: "$credit",
        },
        debit: {
          $sum: "$debit",
        },
        count: {
          $sum: 1,
        },
      },
    };
    let result;
    if (typeof skip !== "undefined") {
      const sort: PipelineStage.Sort = {
        $sort: {
          datetime: -1,
          timestamp: -1,
        },
      };
      result = (
        await transactionModel
          .aggregate([match, project, sort, skip, group], options)
          .exec()
      )[0];
    } else {
      result = (
        await transactionModel
          .aggregate([match, project, group], options)
          .exec()
      )[0];
    }
    return !result
      ? {
          balance: 0,
          notes: 0,
        }
      : {
          balance: result.credit - result.debit,
          notes: result.count,
        };
  }

  async ledger(
    query: IParseQuery,
    populate = null as string[] | null,
    options = {} as IOptions
  ): Promise<{ results: ITransaction[]; total: number }> {
    let skip;
    let limit = 0;

    // Pagination
    if (query.perPage) {
      skip = (query.page ? query.page - 1 : 0) * query.perPage;
      limit = query.perPage;

      delete query.perPage;
      delete query.page;
    }
    const filterQuery = parseQuery(query, { name: this.name });
    const q = transactionModel.find(filterQuery, undefined, options);

    let count = Promise.resolve(0);
    if (typeof skip !== "undefined") {
      count = transactionModel
        .countDocuments(filterQuery)
        .session(options.session || null)
        .exec();
      q.skip(skip).limit(limit);
    }
    q.sort({
      datetime: -1,
      timestamp: -1,
    });
    if (populate) {
      for (let i = 0, il = populate.length; i < il; i++) {
        q.populate(populate[i]);
      }
    }
    const results = await q.exec();
    return {
      results,
      total: (await count) || results.length,
    };
  }

  async void(journal_id: string, reason: string, options = {} as IOptions) {
    const journal = await journalModel
      .findById(journal_id, undefined, options)
      .exec();
    // @ts-ignore
    return await journal.void(this, reason);
  }

  async listAccounts(options = {} as IOptions): Promise<string[]> {
    const results = await transactionModel
      .find({ book: this.name }, undefined, options)
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

import * as mongoose from "mongoose";
import { ObjectId } from "mongodb";
import Entry from "./Entry";
import { journalModel } from "./models/journals";
import { ITransaction, transactionModel } from "./models/transactions";

export class Book {

  name: string;
  private transactionModel: typeof transactionModel;
  private journalModel: typeof journalModel;

  constructor(name: string) {
    this.name = name;
    this.transactionModel = transactionModel;
    this.journalModel = journalModel;
  }

  entry(memo: string, date = null as unknown as Date , original_journal = null as any) {
    return Entry.write(this, memo, date, original_journal);
  }

  /**
   * Turn query into an object readable by MongoDB.
   *
   * @param query {{account: {acct, subacct, subsubacct}, start_date, month_date, meta}}
   * @returns {Object}
   */
  parseQuery(query: { [key: string]: any }) {
    let account, end_date, start_date;
    const parsed: { [key: string]: any } = {};
    if ((account = query.account)) {
      let accounts, i;
      if (account instanceof Array) {
        const $or = [];
        for (const acct of account) {
          accounts = acct.split(":");
          const match: { [key: string]: any } = {};
          for (i = 0; i < accounts.length; i++) {
            match[`account_path.${i}`] = accounts[i];
          }
          $or.push(match);
        }
        parsed["$or"] = $or;
      } else {
        accounts = account.split(":");
        for (i = 0; i < accounts.length; i++) {
          parsed[`account_path.${i}`] = accounts[i];
        }
      }
      delete query.account;
    }

    if (query._journal) {
      parsed["_journal"] = query._journal;
    }

    if (query.start_date && query.end_date) {
      start_date = new Date(query.start_date);
      end_date = new Date(query.end_date);
      parsed["datetime"] = {
        $gte: start_date,
        $lte: end_date
      };
      delete query.start_date;
      delete query.end_date;
    } else if (query.start_date) {
      parsed["datetime"] = { $gte: new Date(parseInt(query.start_date)) };
      delete query.start_date;
    } else if (query.end_date) {
      parsed["datetime"] = { $lte: new Date(parseInt(query.end_date)) };
      delete query.end_date;
    }

    const keys = Object.keys(this.transactionModel.schema.paths);
    for (const key in query) {
      let val = query[key];
      if (keys.indexOf(key) >= 0) {
        // If it starts with a _ assume it's a reference
        if (key.substr(0, 1) === "_" && val instanceof String) {
          val = new ObjectId(val as string);
        }
        parsed[key] = val;
      } else {
        // Assume *_id is an OID
        if (key.indexOf("_id") !== -1) {
          val = new ObjectId(val);
        }

        parsed[`meta.${key}`] = val;
      }
    }

    // Add the book
    parsed.book = this.name;

    parsed.approved = true;
    return parsed;
  }

  async balance(query: { [key: string]: any }) {
    let pagination;

    if (query.perPage) {
      pagination = {
        perPage: query.perPage,
        page: query.page ? query.page : 1
      };

      delete query.perPage;
      delete query.page;
    }
    query = this.parseQuery(query);
    const match = { $match: query };

    const project = {
      $project: {
        debit: "$debit",
        credit: "$credit",
        datetime: "$datetime",
        timestamp: "$timestamp"
      }
    };
    const group = {
      $group: {
        _id: "1",
        credit: {
          $sum: "$credit"
        },
        debit: {
          $sum: "$debit"
        },
        count: {
          $sum: 1
        }
      }
    };
    if (pagination) {
      const skip = { $skip: (pagination.page - 1) * pagination.perPage };
      const sort = {
        $sort: {
          datetime: -1,
          timestamp: -1
        }
      };
      const result = (await this.transactionModel.aggregate([match, project, sort, skip, group]))[0];
      if (!result) {
        return {
          balance: 0,
          notes: 0
        };
      }
      const total = result.credit - result.debit;
      return {
        balance: total,
        notes: result.count
      };
    } else {
      const result2 = (await this.transactionModel.aggregate([match, project, group]))[0];
      if (!result2) {
        return {
          balance: 0,
          notes: 0
        };
      }
      const total = result2.credit - result2.debit;
      return {
        balance: total,
        notes: result2.count
      };
    }
  }

  async ledger(query: { [key: string]: any }, populate = null): Promise<{results: ITransaction[], total: number}> {
    let pagination;

    // Pagination
    if (query.perPage) {
      pagination = {
        perPage: query.perPage,
        page: query.page ? query.page : 1
      };

      delete query.perPage;
      delete query.page;
    }
    query = this.parseQuery(query);
    const q = this.transactionModel.find(query);

    if (pagination) {
      const count = await this.transactionModel.countDocuments(query);
      q.skip((pagination.page - 1) * pagination.perPage).limit(pagination.perPage);
      q.sort({
        datetime: -1,
        timestamp: -1
      });
      if (populate) {
        for (const pop of Array.from(populate)) {
          q.populate(pop);
        }
      }
      const results = await q.exec();
      return {
        results,
        total: count
      };
    } else {
      q.sort({
        datetime: -1,
        timestamp: -1
      });
      if (populate) {
        for (const pop of Array.from(populate)) {
          q.populate(pop);
        }
      }

      const results1 = await q.exec();
      return {
        results: results1,
        total: results1.length
      };
    }
  }

  async void(journal_id: string, reason: string) {
    const journal = (await this.journalModel.findById(journal_id))!;
    // @ts-ignore
    return await journal.void(this, reason);
  }

  async listAccounts() {
    const results = await this.transactionModel.find({ book: this.name }).distinct("accounts");
    const final = new Set();
    for (const result of results) {
      const paths = result.split(":");
      const prev = [];
      for (const acct of paths) {
        prev.push(acct);
        final.add(prev.join(":"));
      }
    }
    return Array.from(final); // uniques
  }
}

export default Book;

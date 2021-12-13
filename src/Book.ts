import Entry from "./Entry";
import { parseQuery } from "./helper/parseQuery";
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
    query = parseQuery(query, this);
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
    query = parseQuery(query, this);
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

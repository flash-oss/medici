import { ObjectId } from "mongodb";
import { FilterQuery } from "mongoose";
import { Book } from "../Book";
import { isValidTransactionKey, ITransaction } from "../models/transactions";

export interface IParseQuery {
  account?: string | string[];
  _journal?: any;
  start_date?: Date | string | number;
  end_date?: Date | string | number;
  perPage?: number;
  page?: number;
  [key: string]: any;
}

const numberRE = /^[0-9]+$/;

/**
 * Turn query into an object readable by MongoDB.
 *
 * @param query {{account: {acct, subacct, subsubacct}, start_date, month_date, meta}}
 * @returns {Object}
 */
export function parseQuery(
  query: IParseQuery,
  book: Pick<Book, "name">
): FilterQuery<ITransaction> {
  let account;

  const parsed: FilterQuery<ITransaction> = {};
  if ((account = query.account)) {
    let accounts, i, il;
    if (Array.isArray(account)) {
      const $or = [];
      for (const acct of account) {
        accounts = acct.split(":");
        const match: { [key: string]: any } = {};
        for (i = 0, il = accounts.length; i < il; i++) {
          match[`account_path.${i}`] = accounts[i];
        }
        $or.push(match);
      }
      parsed["$or"] = $or;
    } else {
      accounts = account.split(":");
      for (i = 0, il = accounts.length; i < il; i++) {
        parsed[`account_path.${i}`] = accounts[i];
      }
    }
    delete query.account;
  }

  if (query._journal) {
    parsed["_journal"] = query._journal;
  }

  if (query.start_date || query.end_date) {
    parsed["datetime"] = {};

    if (query.start_date) {
      if (query.start_date instanceof Date) {
        parsed.datetime.$gte = query.start_date;
      } else if (typeof query.start_date === "number") {
        parsed.datetime.$gte = new Date(query.start_date);
      } else if (
        typeof query.start_date === "string" &&
        numberRE.test(query.start_date)
      ) {
        parsed.datetime.$gte = new Date(parseInt(query.start_date));
      } else {
        parsed.datetime.$gte = new Date(query.start_date);
      }
      delete query.start_date;
    }
    if (query.end_date) {
      if (query.end_date instanceof Date) {
        parsed.datetime.$lte = query.end_date;
      } else if (typeof query.end_date === "number") {
        parsed.datetime.$lte = new Date(query.end_date);
      } else if (
        typeof query.end_date === "string" &&
        numberRE.test(query.end_date)
      ) {
        parsed.datetime.$lte = new Date(parseInt(query.end_date));
      } else {
        parsed.datetime.$lte = new Date(query.end_date);
      }
      delete query.end_date;
    }
  }

  for (const key in query) {
    let val = query[key];
    if (isValidTransactionKey(key)) {
      // If it starts with a _ assume it's a reference
      if (key.substring(0, 1) === "_" && val instanceof String) {
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

  parsed.book = book.name;

  parsed.approved = true;

  return parsed;
}

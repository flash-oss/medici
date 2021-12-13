import { ObjectId } from "mongodb";
import { FilterQuery, isValidObjectId, ObjectId as TObjectId } from "mongoose";
import { Book } from "../Book";
import { isValidTransactionKey, ITransaction } from "../models/transactions";

export interface IParseQuery {
  account?: string | string[];
  _journal?: TObjectId;
  start_date?: Date | string | number;
  end_date?: Date | string | number;
  perPage?: number;
  page?: number;
  approved?: boolean;
  [key: string]: any;
}

const numberRE = /^[0-9]+$/;
const referenceRE = /^_|_id$$/;

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
  let account, i, il;

  const filterQuery: FilterQuery<ITransaction> = {
    book: book.name,
    approved: query.approved !== false,
  };

  if ((account = query.account)) {
    let accounts;
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
      filterQuery["$or"] = $or;
    } else {
      accounts = account.split(":");
      for (i = 0, il = accounts.length; i < il; i++) {
        filterQuery[`account_path.${i}`] = accounts[i];
      }
    }
    delete query.account;
  }

  if (query._journal) {
    filterQuery["_journal"] = query._journal;
    delete query._journal;
  }

  if (query.start_date || query.end_date) {
    filterQuery["datetime"] = {};

    if (query.start_date) {
      if (query.start_date instanceof Date) {
        filterQuery.datetime.$gte = query.start_date;
      } else if (typeof query.start_date === "number") {
        filterQuery.datetime.$gte = new Date(query.start_date);
      } else if (
        typeof query.start_date === "string" &&
        numberRE.test(query.start_date)
      ) {
        filterQuery.datetime.$gte = new Date(parseInt(query.start_date));
      } else {
        filterQuery.datetime.$gte = new Date(query.start_date);
      }
      delete query.start_date;
    }
    if (query.end_date) {
      if (query.end_date instanceof Date) {
        filterQuery.datetime.$lte = query.end_date;
      } else if (typeof query.end_date === "number") {
        filterQuery.datetime.$lte = new Date(query.end_date);
      } else if (
        typeof query.end_date === "string" &&
        numberRE.test(query.end_date)
      ) {
        filterQuery.datetime.$lte = new Date(parseInt(query.end_date));
      } else {
        filterQuery.datetime.$lte = new Date(query.end_date);
      }
      delete query.end_date;
    }
  }

  const keys = Object.keys(query);

  for (i = 0, il = keys.length; i < il; i++) {
    filterQuery[isValidTransactionKey(keys[i]) ? keys[i] : `meta.${keys[i]}`] =
      referenceRE.test(keys[i]) && isValidObjectId(query[keys[i]])
        ? new ObjectId(query[keys[i]])
        : query[keys[i]];
  }

  return filterQuery;
}

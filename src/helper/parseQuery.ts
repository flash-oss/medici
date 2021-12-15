import { FilterQuery, isValidObjectId, Types } from "mongoose";
import { Book } from "../Book";
import { isValidTransactionKey, ITransaction } from "../models/transactions";
import { parseDateField } from "./parseDateField";

export interface IParseQuery {
  account?: string | string[];
  _journal?: Types.ObjectId | string;
  start_date?: Date | string | number;
  end_date?: Date | string | number;
  perPage?: number;
  page?: number;
  approved?: boolean;
  [key: string]: any;
}

export const numberRE = /^\d+$/;
const referenceRE = /(?:^_|_id$)/;

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
  let i, il;

  const {
    page,
    perPage,
    approved,
    account,
    start_date,
    end_date,
    ...extra
  } = query;

  const filterQuery: FilterQuery<ITransaction> = {
    book: book.name,
    approved: approved !== false,
  };

  if (account) {
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
  }

  if (start_date || end_date) {
    filterQuery["datetime"] = {};

    if (start_date) {
      filterQuery.datetime.$gte = parseDateField(start_date);
    }
    if (end_date) {
      filterQuery.datetime.$lte = parseDateField(end_date);
    }
  }

  const keys = Object.keys(extra);

  for (i = 0, il = keys.length; i < il; i++) {
    filterQuery[isValidTransactionKey(keys[i]) ? keys[i] : `meta.${keys[i]}`] =
      referenceRE.test(keys[i]) && isValidObjectId(extra[keys[i]])
        ? new Types.ObjectId(extra[keys[i]])
        : extra[keys[i]];
  }

  return filterQuery;
}

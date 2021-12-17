import { FilterQuery, isValidObjectId, Types } from "mongoose";
import { Book } from "../Book";
import { isValidTransactionKey, ITransaction } from "../models/transactions";
import { parseDateField } from "./parseDateField";

export type IParseQuery = {
  account?: string | string[];
  _journal?: Types.ObjectId | string;
  start_date?: Date | string | number;
  end_date?: Date | string | number;
  approved?: boolean;
} & { [key: string]: string | Date | boolean };

export interface IPaginationQuery {
  perPage?: number;
  page?: number;
}

const referenceRE = /(?:^_|_id$)/;

/**
 * Turn query into an object readable by MongoDB.
 */
export function parseQuery(
  query: IParseQuery & IPaginationQuery,
  book: Pick<Book, "name">
): FilterQuery<ITransaction> {
  let i, il, j, jl;

  const { approved, account, start_date, end_date, ...extra } = query;

  delete extra.perPage;
  delete extra.page;

  const filterQuery: FilterQuery<ITransaction> = {
    book: book.name,
    approved: approved !== false,
  };

  if (account) {
    if (Array.isArray(account) && account.length === 1) {
      const accounts = account[0].split(":");
      for (i = 0, il = accounts.length; i < il; i++) {
        filterQuery[`account_path.${i}`] = accounts[i];
      }
    } else if (Array.isArray(account)) {
      filterQuery["$or"] = new Array(account.length);
      for (i = 0, il = account.length; i < il; i++) {
        const accounts = account[i].split(":");
        filterQuery["$or"][i] = {};
        for (j = 0, jl = accounts.length; j < jl; j++) {
          filterQuery["$or"][i][`account_path.${j}`] = accounts[j];
        }
      }
    } else {
      const accounts = account.split(":");
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
      typeof extra[keys[i]] === "string" &&
      referenceRE.test(keys[i]) &&
      isValidObjectId(extra[keys[i]])
        ? new Types.ObjectId(extra[keys[i]] as string)
        : extra[keys[i]];
  }

  return filterQuery;
}

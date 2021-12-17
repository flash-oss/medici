import { FilterQuery, isValidObjectId, Types } from "mongoose";
import type { Book } from "../Book";
import { isValidTransactionKey, ITransaction } from "../models/transactions";
import { parseAccountField } from "./parseAccountField";
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
  let i, il;

  const { approved, account, start_date, end_date, ...extra } = query;

  delete extra.perPage;
  delete extra.page;

  const filterQuery: FilterQuery<ITransaction> = {
    book: book.name,
    approved: approved !== false,
    ...parseAccountField(account),
  };

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
    const key = keys[i];
    const value = extra[key];
    filterQuery[isValidTransactionKey(key) ? key : `meta.${key}`] =
      typeof value === "string" &&
      referenceRE.test(key) &&
      isValidObjectId(value)
        ? new Types.ObjectId(value)
        : value;
  }

  return filterQuery;
}

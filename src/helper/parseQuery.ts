import { FilterQuery, isValidObjectId, Types } from "mongoose";
import type { Book } from "../Book";
import {
  isTransactionObjectIdKey,
  isValidTransactionKey,
  ITransaction,
} from "../models/transaction";
import { isPrototypeAttribute } from "./isPrototypeAttribute";
import { parseAccountField } from "./parseAccountField";
import { parseDateField } from "./parseDateField";

export type IParseQuery = {
  account?: string | string[];
  _journal?: Types.ObjectId | string;
  start_date?: Date | string | number;
  end_date?: Date | string | number;
  approved?: boolean;
} & {
  [key: string]: string[] | number | string | Date | boolean | Types.ObjectId;
};

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
  book: Pick<Book, "name"> & Partial<Pick<Book, "maxAccountPath">>
): FilterQuery<ITransaction> {
  const { approved, account, start_date, end_date, ...extra } = query;

  const filterQuery: FilterQuery<ITransaction> = {
    book: book.name,
    approved: approved !== false,
    ...parseAccountField(account, book.maxAccountPath),
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

  for (const [key, value] of Object.entries(extra)) {
    if (isPrototypeAttribute(key)) continue;
    filterQuery[isValidTransactionKey(key) ? key : `meta.${key}`] =
      (referenceRE.test(key) && isValidObjectId(value)) ||
      isTransactionObjectIdKey(key)
        ? new Types.ObjectId(value as string)
        : value;
  }

  return filterQuery;
}

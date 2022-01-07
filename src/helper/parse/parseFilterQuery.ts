import { Types } from "mongoose";
import type { Book } from "../../Book";
import { isTransactionObjectIdKey, isValidTransactionKey, ITransaction } from "../../models/transaction";
import { isPrototypeAttribute } from "../isPrototypeAttribute";
import { parseAccountField } from "./parseAccountField";
import { parseDateQuery } from "./parseDateField";
import type { IFilter } from "./IFilter";

export type IFilterQuery = {
  account?: string | string[];
  _journal?: Types.ObjectId | string;
  start_date?: Date | string | number;
  end_date?: Date | string | number;
} & Partial<ITransaction> & {
    [key: string]: string[] | number | string | Date | boolean | Types.ObjectId;
  };

export interface IPaginationQuery {
  perPage?: number;
  page?: number;
}

/**
 * Turn query into an object readable by MongoDB.
 */
export function parseFilterQuery(
  query: IFilterQuery & IPaginationQuery,
  book: Pick<Book, "name"> & Partial<Pick<Book, "maxAccountPath">>
): IFilter {
  const { account, start_date, end_date, ...extra } = query;

  const filterQuery: IFilter = {
    book: book.name,
    ...parseAccountField(account, book.maxAccountPath),
  };

  if (start_date || end_date) {
    filterQuery["datetime"] = parseDateQuery(start_date, end_date);
  }

  for (const [key, value] of Object.entries(extra)) {
    if (isPrototypeAttribute(key)) continue;

    let newValue = value;
    if (typeof value === "string" && isTransactionObjectIdKey(key)) {
      newValue = new Types.ObjectId(value);
    }

    if (isValidTransactionKey(key)) {
      filterQuery[key] = newValue;
    } else {
      if (!filterQuery.meta) filterQuery.meta = {};
      filterQuery.meta[key] = newValue;
    }
  }

  return filterQuery;
}

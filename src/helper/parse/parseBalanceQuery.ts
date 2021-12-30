import { FilterQuery, Types } from "mongoose";
import type { Book } from "../../Book";
import { ITransaction } from "../../models/transaction";
import { isPrototypeAttribute } from "../isPrototypeAttribute";
import { parseAccountField } from "./parseAccountField";
import { parseDateQuery } from "./parseDateField";

export type IBalanceQuery = {
  account?: string | string[];
  start_date?: Date | string | number;
  end_date?: Date | string | number;
} & {
  [key: string]: string[] | number | string | Date | boolean | Types.ObjectId;
};

/**
 * Turn query into an object readable by MongoDB.
 */
export function parseBalanceQuery(
  query: IBalanceQuery,
  book: Pick<Book, "name"> & Partial<Pick<Book, "maxAccountPath">>
): FilterQuery<ITransaction> {
  const { account, start_date, end_date, ...extra } = query;

  const filterQuery: FilterQuery<ITransaction> = {
    book: book.name,
    ...parseAccountField(account, book.maxAccountPath),
  };

  if (start_date || end_date) {
    filterQuery["datetime"] = parseDateQuery(start_date, end_date);
  }

  for (const [key, value] of Object.entries(extra)) {
    if (isPrototypeAttribute(key)) continue;
    if (!filterQuery.meta) filterQuery.meta = {};
    filterQuery.meta[key] = value;
  }

  return filterQuery;
}

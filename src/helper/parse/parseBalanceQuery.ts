import { Types } from "mongoose";
import type { Book } from "../../Book";
import { isPrototypeAttribute } from "../isPrototypeAttribute";
import { parseAccountField } from "./parseAccountField";
import { parseDateQuery } from "./parseDateField";
import type { IFilter } from "./IFilter";
import { IAnyObject } from "../../IAnyObject";
import { isTransactionObjectIdKey, isValidTransactionKey } from "../../models/transaction";
import { flattenObject } from "../flattenObject";

export type IBalanceQuery = {
  account?: string | string[];
  start_date?: Date | string | number;
  end_date?: Date | string | number;
  start_tx_id?: Types.ObjectId;
  end_tx_id?: Types.ObjectId;
} & {
  [key: string]: string[] | number | string | Date | boolean | Types.ObjectId | IAnyObject;
};

/**
 * Turn query into an object readable by MongoDB.
 */
export function parseBalanceQuery(
  query: IBalanceQuery,
  book: Pick<Book, "name"> & Partial<Pick<Book, "maxAccountPath">>
): IFilter {
  const { account, start_date, end_date, start_tx_id, end_tx_id, ...extra } = query;

  const filterQuery: IFilter = {
    book: book.name,
    ...parseAccountField(account, book.maxAccountPath),
  };

  if (start_date || end_date) {
    filterQuery["datetime"] = parseDateQuery(start_date, end_date);
  }

  if (start_tx_id || end_tx_id) {
    const q : { $gt?: Types.ObjectId; $lte?: Types.ObjectId; } = {};
    if (start_tx_id) {
      q.$gt = start_tx_id
    }
    if (end_tx_id) {
      q.$lte = end_tx_id
    }
    filterQuery["_id"] = q;
  }

  const meta: IAnyObject = {};
  for (const [key, value] of Object.entries(extra)) {
    if (isPrototypeAttribute(key)) continue;
    if (!filterQuery.meta) filterQuery.meta = {};
    filterQuery.meta[key] = value;

    let newValue = value;
    if (typeof value === "string" && isTransactionObjectIdKey(key)) {
      newValue = new Types.ObjectId(value);
    }

    if (isValidTransactionKey(key)) {
      filterQuery[key] = newValue;
    } else {
      meta[key] = newValue;
    }
  }

  return { ...filterQuery, ...flattenObject(meta, "meta") };
}

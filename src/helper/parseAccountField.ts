import type { FilterQuery } from "mongoose";
import type { ITransaction } from "../models/transaction";

export function parseAccountField(
  account: string | string[] | undefined,
  maxAccountPath = 3
): FilterQuery<ITransaction> {
  const filterQuery: FilterQuery<ITransaction> = {};

  if (typeof account === "string") {
    const splitAccount = account.split(":");
    if (splitAccount.length === maxAccountPath) {
      filterQuery.accounts = account;
    } else {
      for (let i = 0; i < splitAccount.length; i++) {
        filterQuery[`account_path.${i}`] = splitAccount[i];
      }
    }
  } else if (Array.isArray(account)) {
    if (account.length === 1) {
      return parseAccountField(account[0], maxAccountPath);
    } else {
      filterQuery["$or"] = new Array(account.length);
      for (let i = 0; i < account.length; i++) {
        filterQuery["$or"][i] = parseAccountField(account[i], maxAccountPath);
      }
    }
  }

  return filterQuery;
}

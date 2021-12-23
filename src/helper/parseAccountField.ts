import type { FilterQuery } from "mongoose";
import type { ITransaction } from "../models/transaction";

export function parseAccountField(
  account: string | string[] | undefined,
  maxAccountPath = 3
): FilterQuery<ITransaction> {
  const filterQuery: FilterQuery<ITransaction> = {};
  let i, il, j, jl;

  if (Array.isArray(account) && account.length === 1) {
    const accounts = account[0].split(":");
    if (accounts.length === maxAccountPath) {
      filterQuery.accounts = account[0];
    } else {
      for (i = 0, il = accounts.length; i < il; i++) {
        filterQuery[`account_path.${i}`] = accounts[i];
      }
    }
  } else if (Array.isArray(account)) {
    filterQuery["$or"] = new Array(account.length);
    for (i = 0, il = account.length; i < il; i++) {
      const accounts = account[i].split(":");
      filterQuery["$or"][i] = {};
      if (accounts.length === maxAccountPath) {
        filterQuery["$or"][i][`accounts`] = account[i];
      } else {
        for (j = 0, jl = accounts.length; j < jl; j++) {
          filterQuery["$or"][i][`account_path.${j}`] = accounts[j];
        }
      }
    }
  } else if (
    typeof account === "string" &&
    account.split(":").length === maxAccountPath
  ) {
    filterQuery.accounts = account;
  } else if (typeof account === "string") {
    const accounts = account.split(":");
    for (i = 0, il = accounts.length; i < il; i++) {
      filterQuery[`account_path.${i}`] = accounts[i];
    }
  }
  return filterQuery;
}

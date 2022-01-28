import type { IFilter } from "./IFilter";

export function parseAccountField(account: string | string[] | undefined, maxAccountPath = 3): IFilter {
  const filterQuery: IFilter = {};

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

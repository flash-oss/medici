import { Entry } from "..";
import { IAnyObject } from "../IAnyObject";
import { ITransaction } from "../models/transaction";
import { safeSetKeyToMetaObject } from "./safeSetKeyToMetaObject";

export function addReversedTransactions<T extends ITransaction = ITransaction>(entry: Entry, transactions: T[]) {
  for (const transaction of transactions) {
    const newMeta: IAnyObject = {};
    for (const [key, value] of Object.entries(transaction)) {
      if (key === "meta") {
        for (const [keyMeta, valueMeta] of Object.entries(value)) {
          safeSetKeyToMetaObject(keyMeta, valueMeta, newMeta);
        }
      } else {
        safeSetKeyToMetaObject(key, value, newMeta);
      }
    }

    if (transaction.credit) {
      entry.debit(transaction.account_path, transaction.credit, newMeta);
    }
    if (transaction.debit) {
      entry.credit(transaction.account_path, transaction.debit, newMeta);
    }
  }
}
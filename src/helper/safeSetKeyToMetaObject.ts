import { isValidTransactionKey, transactionSchema } from "../models/transaction";
import { isPrototypeAttribute } from "./isPrototypeAttribute";
import type { IAnyObject } from "../IAnyObject";

const originalSchema = new Set(Object.keys(transactionSchema.paths));

export function safeSetKeyToMetaObject(key: string, val: unknown, meta: IAnyObject): void {
  if (isPrototypeAttribute(key)) return;
  if (!isValidTransactionKey(key, originalSchema)) meta[key] = val;
}

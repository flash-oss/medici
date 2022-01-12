import { isValidTransactionKey } from "../models/transaction";
import { isPrototypeAttribute } from "./isPrototypeAttribute";
import type { IAnyObject } from "../IAnyObject";

export function safeSetKeyToMetaObject(key: string, val: unknown, meta: IAnyObject): void {
    if (isPrototypeAttribute(key)) return;
    if (!isValidTransactionKey(key)) meta[key] = val;
  }
  
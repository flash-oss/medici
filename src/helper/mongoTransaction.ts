/* eslint require-await: off */
import { ClientSession, connection } from "mongoose";
import { IAnyObject } from "../IAnyObject";

export async function mongoTransaction<T = unknown>(fn: (session: ClientSession) => Promise<T>, options?: IAnyObject) {
  return connection.transaction(fn, options);
}

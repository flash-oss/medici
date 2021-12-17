/* eslint require-await: off */
import { ClientSession, connection } from "mongoose";

export async function mongoTransaction<T = unknown>(
  fn: (session: ClientSession) => Promise<T>
) {
  return connection.transaction(fn);
}

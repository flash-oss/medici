import { ClientSession, connection } from "mongoose";

export async function mongoTransaction(
  fn: (session: ClientSession) => Promise<any>
) {
  return connection.transaction(fn);
}

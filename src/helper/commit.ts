import Entry from "../Entry";
import { mongoTransaction } from "./mongoTransaction";
import { IJournal } from "../models/journal";

export async function commit(...entries: Entry[]): Promise<IJournal[]> {
  let journals: IJournal[] = [];
  await mongoTransaction(async session => {
      journals = await Promise.all(entries.map(entry => entry.commit({ session })));
  });
  return journals;
}

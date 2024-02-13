import { Entry } from "../Entry";
import { mongoTransaction } from "./mongoTransaction";
import { IJournal } from "../models/journal";
import { MediciError } from "../errors";

export async function commit(...entries: Entry[]): Promise<IJournal[]> {
  if (!entries.length) throw new MediciError("Nothing to commit. At least one entry must be provided.");

  let committedJournals: IJournal[] = [];

  if (entries.length === 1) {
    committedJournals.push(await entries[0].commit());
  } else {
    await mongoTransaction(async (session) => {
      committedJournals = await Promise.all(entries.map((entry) => entry.commit({ session })));
    });
  }

  return committedJournals;
}

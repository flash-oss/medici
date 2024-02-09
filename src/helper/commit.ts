import Entry from "../Entry";
import { TransactionError } from "../errors";
import * as mongoose from "mongoose";

export async function commit(...entries: Entry[]) {
  const mongooseSession = await mongoose.startSession();
  try {
    mongooseSession.startTransaction();
    const journals = await Promise.all(entries.map(entry => entry.commit()));
    await mongooseSession.commitTransaction();
    return journals;
  } catch (error) {
    await mongooseSession.abortTransaction();
    throw new TransactionError(`Failure to commit entries: ${(error as Error).message}`, entries.length,500);
  } finally {
    await mongooseSession.endSession();
  }
}

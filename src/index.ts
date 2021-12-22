import { Book } from "./Book";
import type { Entry } from "./Entry";

export { setJournalSchema } from "./models/journals";
export { setTransactionSchema } from "./models/transactions";
export { setLockSchema } from "./models/locks";
export { mongoTransaction } from "./helper/mongoTransaction";
export { initModels } from "./helper/initModels";
export { syncIndexes } from "./helper/syncIndexes";

export { MediciError } from "./errors/MediciError";
export { BookConstructorError } from "./errors/BookConstructorError";
export { InvalidAccountPathLengthError } from "./errors/InvalidAccountPathLengthError";
export { JournalAlreadyVoidedError } from "./errors/JournalAlreadyVoidedError";
export { JournalNotFoundError } from "./errors/JournalNotFoundError";
export { TransactionError } from "./errors/TransactionError";

export { Book, Entry };
export default Book;

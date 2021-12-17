import { Book } from "./Book";
import type { Entry } from "./Entry";

export { setJournalSchema } from "./models/journals";
export { setTransactionSchema } from "./models/transactions";
export { initModels } from "./helper/initModels";

export { Book, Entry };
export default Book;

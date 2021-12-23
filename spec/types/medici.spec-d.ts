/* eslint import/no-unresolved: off */
import { expectError, expectType } from "tsd";
import BookESM, {
  Book,
  Entry,
  setJournalSchema,
  setTransactionSchema,
} from "../../types/index";
import { Types, Document, ClientSession } from "mongoose";
import { ITransaction } from "../../src/models/transaction";

expectType<Book>(new BookESM("MyBook"));
expectType<Book>(new Book("MyBook"));
expectType<Book>(new Book("MyBook", {}));
expectType<Book>(new Book("MyBook", { precision: 8 }));
expectError(new Book());
expectError(new Book("MyBook", ""));
expectError(new Book("MyBook", 7));
expectError(new Book("MyBook", { precision: "8" }));
expectError(new Book("MyBook", { precision: true }));

expectError(setJournalSchema());
expectError(setTransactionSchema());

const book = new Book("MyBook");

expectError(book.entry());
expectType<Entry>(book.entry("a memo"));
expectType<Entry>(book.entry("a memo", undefined, new Types.ObjectId()));
expectType<Entry>(book.entry("a memo", new Date(), undefined));
expectType<Entry>(book.entry("a memo", new Date(), new Types.ObjectId()));
expectType<Entry>(book.entry("a memo", new Date(), "123456789012345678901234"));

expectError(book.entry("a memo").credit());
expectError(book.entry("a memo").credit("Assets"));
expectType<Entry>(book.entry("a memo").credit("Assets", 200));
expectType<Entry>(
  book.entry("a memo").credit("Assets", 200, { approved: true })
);
expectError(book.entry("a memo").credit("Assets", 200, "invalid"));
expectType<Entry>(
  book.entry("a memo").credit("Assets", 200, { fieldA: "aaa" })
);
expectError(book.entry("a memo").credit("Assets", 200, { credit: "aaa" }));
expectType<Entry>(
  book
    .entry("a memo")
    .credit<{ fieldA: string }>("Assets", 200, { fieldA: "aaa" })
);
expectType<Entry>(
  book
    .entry("a memo")
    .credit<{ fieldA: string }>("Assets", 200, { fieldA: "aaa", credit: 2 })
);
expectError(
  book
    .entry("a memo")
    .credit<{ fieldA: string }>("Assets", 200, { fieldB: "aaa" })
);

async () => {
  expectType<{ results: ITransaction[]; total: number }>(await book.ledger({}));
  expectType<{ results: ITransaction[]; total: number }>(
    await book.ledger({}, null, { lean: true })
  );
  expectType<{ results: (Document & ITransaction)[]; total: number }>(
    await book.ledger({}, null, { lean: false })
  );
  expectType<{ results: ITransaction[]; total: number }>(
    await book.ledger({}, null, { session: null as unknown as ClientSession })
  );
  expectType<{ results: ITransaction[]; total: number }>(
    await book.ledger({}, null, {
      session: null as unknown as ClientSession,
      lean: true,
    })
  );
  expectType<{ results: (Document & ITransaction)[]; total: number }>(
    await book.ledger({}, null, {
      session: null as unknown as ClientSession,
      lean: false,
    })
  );
};

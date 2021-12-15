/* eslint import/no-unresolved: off */
import { expectError, expectType } from "tsd";
import BookESM, { Book, Entry } from "../../types/index";
import { Types, Document, ClientSession } from "mongoose";
import { ITransaction } from "../../src/models/transactions";

expectType<Book>(new BookESM("MyBook"));
expectType<Book>(new Book("MyBook"));
expectError(new Book());

const book = new Book("MyBook");

expectError(book.entry());
expectType<Entry>(book.entry("a memo"));
expectType<Entry>(book.entry("a memo", undefined, new Types.ObjectId()));
expectType<Entry>(book.entry("a memo", new Date(), undefined));
expectType<Entry>(book.entry("a memo", new Date(), new Types.ObjectId()));

expectError(book.entry("a memo").credit());
expectError(book.entry("a memo").credit("Assets"));
expectType<Entry>(book.entry("a memo").credit("Assets", 200));
expectType<Entry>(
  book.entry("a memo").credit("Assets", 200, { approved: true })
);
expectError(book.entry("a memo").credit("Assets", 200, "invalid"));

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
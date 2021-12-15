/* eslint sonarjs/no-duplicate-string: off */
import { Book } from "../src/Book";
import * as assert from "assert";
import { Document, Types } from "mongoose";
import { IJournal } from "../src/models/journals";
import { TransformStreamDefaultController } from "node:stream/web";

describe("general", function () {
  let sharedJournal:
    | (Document<any, any, any> &
        IJournal & {
          _original_journal?: Types.ObjectId;
        })
    | null = null;

  it("should let you create a basic transaction", async function () {
    const book = new Book("MyBook");
    const journal = await book
      .entry("Test Entry")
      .debit("Assets:Receivable", 500, { clientId: "12345" })
      .credit("Income:Rent", 500)
      .commit();
    assert.strictEqual(journal.memo, "Test Entry");
    assert.strictEqual(journal._transactions.length, 2);
    sharedJournal = journal;
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const journal1 = await book
      .entry("Test Entry 2", threeDaysAgo)
      .debit("Assets:Receivable", 700)
      .credit("Income:Rent", 700)
      .commit();
    assert.strictEqual(journal1.book, "MyBook");
    assert.strictEqual(journal1.memo, "Test Entry 2");
    assert.strictEqual(journal1._transactions.length, 2);
  });

  it("should deal with JavaScript rounding weirdness", async function () {
    const book = new Book("MyBook");
    await book
      .entry("Rounding Test")
      .credit("A:B", 1005)
      .debit("A:B", 994.95)
      .debit("A:B", 10.05)
      .commit();
    const result1 = await book.balance({ account: "A:B" });
    const { balance } = result1;
    assert.strictEqual(balance, 0);
  });

  it("should throw INVALID_JOURNAL if an entry total is !=0 and <0", async () => {
    const book = new Book("MyBook");
    const entry = book.entry("This is a test entry");
    entry.debit("Assets:Cash", 99.9, {});
    entry.credit("Income", 99.8, {});
    await assert.rejects(entry.commit(), {
      message: "INVALID_JOURNAL: can't commit non zero total",
    });
  });

  it("should throw INVALID_JOURNAL if an entry total is !=0 and >0", async () => {
    const book = new Book("MyBook");
    const entry = book.entry("This is a test entry");
    entry.debit("Assets:Cash", 99.8, {});
    entry.credit("Income", 99.9, {});
    await assert.rejects(entry.commit(), {
      message: "INVALID_JOURNAL: can't commit non zero total",
    });
  });

  it("should have updated the balance for assets and income and accurately give balance for subaccounts", async () => {
    const book = new Book("MyBook");

    const data = await book.balance({
      account: "Assets",
    });
    let bal = data.balance;
    let { notes } = data;
    assert.strictEqual(notes, 2);
    assert.strictEqual(bal, -1200);

    const data1 = await book.balance({ account: "Assets:Receivable" });
    bal = data1.balance;
    ({ notes } = data1);
    assert.strictEqual(bal, -1200);
    assert.strictEqual(notes, 2);

    const data2 = await book.balance({
      account: "Assets:Other",
    });
    bal = data2.balance;
    ({ notes } = data2);
    assert.strictEqual(bal, 0);
    assert.strictEqual(notes, 0);
  });

  it("should return full ledger", async () => {
    const book = new Book("MyBook");
    const res = await book.ledger({
      account: "Assets",
    });
    assert.strictEqual(res.results.length, 2);
  });

  it("should return full ledger with hydrated objects", async () => {
    const book = new Book("MyBook");
    const res = await book.ledger({
      account: "Assets",
    });
    assert.strictEqual(res.results.length, 2);
    assert.ok(res.results[0].hasOwnProperty("_doc") === true);
    assert.ok(res.results[1].hasOwnProperty("_doc") === true);
  });

  it("should return full ledger with lean objects", async () => {
    const book = new Book("MyBook");
    const res = await book.ledger(
      {
        account: "Assets",
      },
      null,
      { lean: true }
    );
    assert.strictEqual(res.results.length, 2);
    assert.ok(res.results[0].hasOwnProperty("_doc") === false);
    assert.ok(res.results[1].hasOwnProperty("_doc") === false);
  });

  it("should return full ledger with just ObjectId of the _journal attribute", async () => {
    const book = new Book("MyBook");
    const res = await book.ledger({
      account: "Assets",
    });
    assert.strictEqual(res.results.length, 2);
    assert.ok(res.results[0]._journal instanceof Types.ObjectId);
    assert.ok(res.results[1]._journal instanceof Types.ObjectId);
  });

  it("should return full ledger with populated _journal", async () => {
    const book = new Book("MyBook");
    const res = await book.ledger(
      {
        account: "Assets",
      },
      ["_journal"]
    );
    assert.ok(res.results[0]._journal._id instanceof Types.ObjectId);
    assert.ok(res.results[1]._journal._id instanceof Types.ObjectId);
    assert.strictEqual(res.results.length, 2);
  });

  it("should allow you to void a journal entry", async () => {
    const book = new Book("MyBook");
    const data = await book.balance({
      account: "Assets",
      clientId: "12345",
    });
    assert.strictEqual(data.balance, -500);

    await book.void(sharedJournal!._id, "Messed up");
    const data1 = await book.balance({
      account: "Assets",
    });
    assert.strictEqual(data1.balance, -700);

    const data2 = await book.balance({
      account: "Assets",
      clientId: "12345",
    });
    assert.strictEqual(data2.balance, 0);
  });

  it("should list all accounts", async () => {
    const book = new Book("MyBook");
    const accounts = await book.listAccounts();
    assert.ok(accounts.includes("Assets"));
    assert.ok(accounts.includes("Assets:Receivable"));
    assert.ok(accounts.includes("Income"));
    assert.ok(accounts.includes("Income:Rent"));
  });

  it("should return ledger with array of accounts", async () => {
    const book = new Book("MyBook");
    const response = await book.ledger({
      account: ["Assets", "Income"],
    });
    assert.strictEqual(response.results.length, 6);
    for (const res of response.results) {
      assert.ok(
        res.account_path.includes("Assets") ||
          res.account_path.includes("Income")
      );
    }
  });
});

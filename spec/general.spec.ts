/* eslint sonarjs/no-duplicate-string: off, no-prototype-builtins: off*/
import { Book } from "../src/Book";
import * as assert from "assert";
import { Document, Types } from "mongoose";
import { IJournal } from "../src/models/journals";
import { expect } from "chai";
import { stub } from "sinon";
import { transactionModel } from "../src/models/transactions";

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

  it("should let you use strings for amounts", async function () {
    const book = new Book("MyBookAmountStrings");
    await book
      .entry("Test Entry")
      .debit("Assets:Receivable", "500", { clientId: "12345" })
      .credit("Income:Rent", "500")
      .commit();
    let result = await book.balance({ account: "Assets" });
    assert.strictEqual(result.balance, -500);

    result = await book.balance({ account: "Income" });
    assert.strictEqual(result.balance, 500);
  });

  it("should let you use string for original journal", async function () {
    const book = new Book("MyBookAmountStrings");
    const journal = await book
      .entry("Test Entry", null, "012345678901234567890123")
      .debit("Assets:Receivable", "500", { clientId: "12345" })
      .credit("Income:Rent", "500")
      .commit();

    expect(journal._original_journal).to.be.instanceOf(Types.ObjectId);
    expect(journal._original_journal.toString()).to.be.equal(
      "012345678901234567890123"
    );
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

  it("should return full ledger with hydrated objects when lean is not set", async () => {
    const book = new Book("MyBook");
    const res = await book.ledger({
      account: "Assets",
    });
    assert.strictEqual(res.results.length, 2);
    assert.ok(res.results[0].hasOwnProperty("_doc") === false);
    assert.ok(res.results[1].hasOwnProperty("_doc") === false);
  });

  it("should return full ledger with hydrated objects when lean is set to false", async () => {
    const book = new Book("MyBook");
    const res = await book.ledger(
      {
        account: "Assets",
      },
      undefined,
      { lean: false }
    );
    assert.strictEqual(res.results.length, 2);
    assert.ok(res.results[0].hasOwnProperty("_doc") === true);
    assert.ok(res.results[1].hasOwnProperty("_doc") === true);
  });

  it("should return full ledger with lean objects when lean is set to true", async () => {
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
    const clientAccount = await book.balance({
      account: "Assets",
      clientId: "12345",
    });
    assert.strictEqual(clientAccount.balance, 0);
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

  it("should throw an error if journal was already voided", () => {
    const book = new Book("MyBook");
    book
      .void(sharedJournal!._id, "Messed up")
      .then(() => {
        throw new Error("Should have thrown.");
      })
      .catch((err) => err.message === "Journal already voided");
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

  it("should handle extra data when creating an Entry", async () => {
    const book = new Book(
      "MyBook-Entry-Test" + new Types.ObjectId().toString()
    );

    await book
      .entry("extra")
      .credit("A:B", 1, { credit: 2, clientId: "Mr. A" })
      .debit("A:B", 1, { debit: 2, clientId: "Mr. B" })
      .commit();

    const { balance } = await book.balance({ account: "A:B" });
    expect(balance).to.be.equal(0);

    const res = await book.ledger({
      account: "A:B",
    });

    if (res.results[0].meta.clientId === "Mr. A") {
      expect(res.results[0].credit).to.be.equal(2);
      expect(res.results[0].meta.clientId).to.be.equal("Mr. A");
      expect(res.results[1].debit).to.be.equal(2);
      expect(res.results[1].meta.clientId).to.be.equal("Mr. B");
    } else {
      expect(res.results[1].credit).to.be.equal(2);
      expect(res.results[1].meta.clientId).to.be.equal("Mr. A");
      expect(res.results[0].debit).to.be.equal(2);
      expect(res.results[0].meta.clientId).to.be.equal("Mr. B");
    }
  });

  it("should delete transactions when not in transaction and saving the journal fails", async () => {
    const book = new Book(
      "MyBook-Entry-Test" + new Types.ObjectId().toString()
    );

    try {
      await book
        .entry("extra")
        .debit("A:B", 1, { debit: 2, clientId: "Mr. B" })
        // @ts-expect-error
        .credit("A:B", 1, { credit: 2, timestamp: "asdasd" })
        .commit();
    } catch (e) {
      expect(e.message).to.match(
        /Failure to save journal: Medici_Transaction validation failed/
      );
    }

    const { balance } = await book.balance({ account: "A:B" });
    expect(balance).to.be.equal(0);
  });

  it("should delete transactions when not in transaction and saving the journal fails", async () => {
    const book = new Book(
      "MyBook-Entry-Test" + new Types.ObjectId().toString()
    );

    const deleteManyStub = stub(transactionModel, "deleteMany").throws(
      new Error()
    );
    const consoleErrorStub = stub(console, "error");

    try {
      await book
        .entry("extra")
        .debit("A:B", 1, { debit: 2, clientId: "Mr. B" })
        // @ts-expect-error
        .credit("A:B", 1, { credit: 2, timestamp: "asdasd" })
        .commit();
    } catch (e) {
      expect(e.message).to.match(
        /Failure to save journal: Medici_Transaction validation failed/
      );
    }

    expect(consoleErrorStub.firstCall.args[0]).match(
      /Can't delete txs for journal [a-f0-9]{24}. Medici ledger consistency got harmed./
    );
    deleteManyStub.restore();
    consoleErrorStub.restore();

    const { balance } = await book.balance({ account: "A:B" });
    expect(balance).to.be.equal(-2);
  });
});

/* eslint sonarjs/no-duplicate-string: off, @typescript-eslint/no-non-null-assertion: off, no-prototype-builtins: off*/
import { Book, JournalNotFoundError } from "../src";
import { Document, Types } from "mongoose";
import { IJournal } from "../src/models/journal";
import { expect } from "chai";
import { spy } from "sinon";
import { transactionModel } from "../src/models/transaction";
import { balanceModel } from "../src/models/balance";
import delay from "./helper/delay";
import * as moment from "moment";
import { DateTime } from "luxon";

describe("book", function () {
  describe("constructor", () => {
    it("should throw an error when name of book is not a string", () => {
      // @ts-expect-error we need a string
      expect(() => new Book(1337)).to.throw("Invalid value for name provided.");
    });
    it("should throw an error when name of book is empty string", () => {
      expect(() => new Book("")).to.throw("Invalid value for name provided.");
    });
    it("should throw an error when name of book is a string with only whitespace", () => {
      expect(() => new Book(" ")).to.throw("Invalid value for name provided.");
    });
    it("should throw an error when maxAccountPath of book is a fraction", () => {
      expect(() => new Book("MyBook", { maxAccountPath: 3.14 })).to.throw("Invalid value for maxAccountPath provided.");
    });
    it("should throw an error when maxAccountPath of book is a negative number", () => {
      expect(() => new Book("MyBook", { maxAccountPath: -3 })).to.throw("Invalid value for maxAccountPath provided.");
    });
    it("should throw an error when maxAccountPath of book is not a number", () => {
      // @ts-expect-error we need a number
      expect(() => new Book("MyBook", { maxAccountPath: "7" })).to.throw("Invalid value for maxAccountPath provided.");
    });
    it("should throw an error when precision of book is a fraction", () => {
      expect(() => new Book("MyBook", { precision: 3.14 })).to.throw("Invalid value for precision provided.");
    });
    it("should throw an error when precision of book is a negative number", () => {
      expect(() => new Book("MyBook", { precision: -3 })).to.throw("Invalid value for precision provided.");
    });
    it("should throw an error when precision of book is not a number", () => {
      // @ts-expect-error we need a number
      expect(() => new Book("MyBook", { precision: "7" })).to.throw("Invalid value for precision provided.");
    });
    it("should throw an error when balanceSnapshotSec of book is not a number", () => {
      // @ts-expect-error we need a number
      expect(() => new Book("MyBook", { balanceSnapshotSec: "999" })).to.throw(
        "Invalid value for balanceSnapshotSec provided."
      );
    });
    it("should throw an error when balanceSnapshotSec of book is a negative number", () => {
      expect(() => new Book("MyBook", { balanceSnapshotSec: -3 })).to.throw(
        "Invalid value for balanceSnapshotSec provided."
      );
    });
    it("should throw an error when expireBalanceSnapshotSec of book is not a number", () => {
      // @ts-expect-error we need a number
      expect(() => new Book("MyBook", { expireBalanceSnapshotSec: "999" })).to.throw(
        "Invalid value for expireBalanceSnapshotSec provided."
      );
    });
    it("should throw an error when expireBalanceSnapshotSec of book is a negative number", () => {
      expect(() => new Book("MyBook", { expireBalanceSnapshotSec: -3 })).to.throw(
        "Invalid value for expireBalanceSnapshotSec provided."
      );
    });
  });

  describe("journaling", () => {
    it("should error when trying to use an account with more than three parts", () => {
      expect(() => {
        const book = new Book("MyBookAccounts");
        book.entry("depth test").credit("X:Y:AUD:BTC", 1);
      }).to.throw("Account path is too deep (maximum 3)");
    });

    it("should allow more than 4 subaccounts of third level", async function () {
      const book = new Book("MyBookSubaccounts");
      await book
        .entry("depth test")
        .credit("X:Y:AUD", 1)
        .credit("X:Y:EUR", 1)
        .credit("X:Y:USD", 1)
        .credit("X:Y:INR", 1)
        .credit("X:Y:CHF", 1)
        .debit("CashAssets", 5)
        .commit();

      const result = await book.balance({ account: "X:Y" });
      expect(result.balance).to.be.equal(5);

      const accounts = await book.listAccounts();
      expect(accounts).to.have.lengthOf(8);
      expect(accounts).to.include("X");
      expect(accounts).to.include("X:Y");
      expect(accounts).to.include("X:Y:AUD");
      expect(accounts).to.include("X:Y:EUR");
      expect(accounts).to.include("X:Y:USD");
      expect(accounts).to.include("X:Y:INR");
      expect(accounts).to.include("X:Y:CHF");
      expect(accounts).to.include("CashAssets");
    });

    it("should let you create and query a basic transaction", async function () {
      const book = new Book("MyBook-basic-transaction");
      const journal = await book
        .entry("Test Entry")
        .debit("Assets:Receivable", 500, { clientId: "12345", bookmarked: true })
        .credit("Income:Rent", 500)
        .commit();
      expect(journal.memo).to.be.equal("Test Entry");
      expect(journal._transactions).to.be.have.lengthOf(2);

      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const journal1 = await book
        .entry("Test Entry 2", threeDaysAgo)
        .debit("Assets:Receivable", 700)
        .credit("Income:Rent", 700, { clientId: "12345", bookmarked: true })
        .commit();
      expect(journal1.book).to.be.equal("MyBook-basic-transaction");
      expect(journal1.memo).to.be.equal("Test Entry 2");
      expect(journal._transactions).to.be.have.lengthOf(2);

      const entries0 = await book.ledger({ clientId: "12345" });
      expect(entries0.total).to.equal(2);
      expect(entries0.results[0]).to.have.property("debit", 500);
      expect(entries0.results[1]).to.have.property("credit", 700);

      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const entries1 = await book.ledger({ accounts: "Assets:Receivable", start_date: moment(twoDaysAgo) });
      expect(entries1.total).to.equal(1);
      expect(entries1.results[0]).to.have.property("debit", 500);

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const entries2 = await book.ledger({ accounts: "Assets:Receivable", start_date: DateTime.fromJSDate(oneDayAgo) });
      expect(entries2.total).to.equal(1);
      expect(entries1.results[0]).to.have.property("debit", 500);
    });

    it("should let you use strings for amounts", async function () {
      const book = new Book("MyBookAmountStrings");
      await book
        .entry("Test Entry")
        .debit("Assets:Receivable", "500", { clientId: "12345" })
        .credit("Income:Rent", "500")
        .commit();
      let result = await book.balance({ account: "Assets" });
      expect(result.balance).to.be.equal(-500);

      result = await book.balance({ account: "Income" });
      expect(result.balance).to.be.equal(500);
    });

    it("should allow meta querying using mongodb query language", async function () {
      const book = new Book("MyBookAmountStrings-mongodb-query-language");
      await book
        .entry("Test Entry")
        .debit("Assets:Receivable", 123, { clientId: "12345" })
        .credit("Income:Rent", 123)
        .commit();
      const result = await book.balance({ account: "Assets:Receivable", clientId: { $in: ["12345", "67890"] } });
      expect(result.balance).to.be.equal(-123);
    });

    it("should let you use string for original journal", async function () {
      const book = new Book("MyBookAmountStrings");
      const journal = await book
        .entry("Test Entry", null, "012345678901234567890123")
        .debit("Assets:Receivable", "500", { clientId: "12345" })
        .credit("Income:Rent", "500")
        .commit();

      expect(journal._original_journal).to.be.instanceOf(Types.ObjectId);
      expect(journal._original_journal!.toString()).to.be.equal("012345678901234567890123");
    });

    it("should throw INVALID_JOURNAL if an entry total is !=0 and <0", async () => {
      const book = new Book("MyBook-invalid");
      const entry = book.entry("This is a test entry");
      entry.debit("Assets:Cash", 99.9, {});
      entry.credit("Income", 99.8, {});

      try {
        await entry.commit();
        expect.fail("Should have thrown");
      } catch (e) {
        expect((e as Error).message).to.be.equal("INVALID_JOURNAL: can't commit non zero total");
      }
    });

    it("should throw INVALID_JOURNAL if an entry total is !=0 and >0", async () => {
      const book = new Book("MyBook");
      const entry = book.entry("This is a test entry");
      entry.debit("Assets:Cash", 99.8, {});
      entry.credit("Income", 99.9, {});
      try {
        await entry.commit();
        expect.fail("Should have thrown");
      } catch (e) {
        expect((e as Error).message).to.be.equal("INVALID_JOURNAL: can't commit non zero total");
      }
    });

    it("should handle extra data when creating an Entry", async () => {
      const book = new Book("MyBook-Entry-Test" + new Types.ObjectId().toString());

      await book
        .entry("extra")
        .credit("A:B", 1, { credit: 2, clientId: "Mr. A" })
        .debit("A:B", 1, { debit: 2, clientId: "Mr. B" })
        .commit();

      const { balance } = await book.balance({ account: "A:B" });
      expect(balance).to.be.equal(0);

      const res = await book.ledger({ account: "A:B" });

      if (res.results[0].meta!.clientId === "Mr. A") {
        expect(res.results[0].credit).to.be.equal(2);
        expect(res.results[0].meta!.clientId).to.be.equal("Mr. A");
        expect(res.results[1].debit).to.be.equal(2);
        expect(res.results[1].meta!.clientId).to.be.equal("Mr. B");
      } else {
        expect(res.results[1].credit).to.be.equal(2);
        expect(res.results[1].meta!.clientId).to.be.equal("Mr. A");
        expect(res.results[0].debit).to.be.equal(2);
        expect(res.results[0].meta!.clientId).to.be.equal("Mr. B");
      }
    });

    it("should save all transactions in bulk and mitigate mongodb 'insertedIds' bug", async () => {
      const book = new Book("MyBook-Entry-Test-bulk-saving");

      const saveSpy = spy(transactionModel.collection, "insertMany");
      const findSpy = spy(transactionModel.collection, "find");

      try {
        await book
          .entry("extra")
          .debit("A:B", 1, { debit: 2, clientId: "Mr. B" })
          .credit("A:B", 1, { credit: 2 })
          .commit();
      } finally {
        saveSpy.restore();
        findSpy.restore();
      }

      expect(saveSpy.callCount).equal(1); // should attempts saving both transactions in parallel
      expect(saveSpy.firstCall.args[1]).include({
        forceServerObjectId: true,
        ordered: true,
      });

      expect(findSpy.firstCall.args[0]).have.property("_journal");
      expect(findSpy.firstCall.args[1]!.projection).have.property("_id", 1);

      const { balance } = await book.balance({ account: "A:B" });
      expect(balance).to.be.equal(0);
    });
  });

  describe("balance", () => {
    async function addBalance(book: Book) {
      await book
        .entry("Test Entry")
        .debit("Assets:Receivable", 700, { clientId: "67890", otherProp: 1 })
        .credit("Income:Rent", 700)
        .commit();
      await book
        .entry("Test Entry")
        .debit("Assets:Receivable", 500, { clientId: "12345", otherProp: 1 })
        .credit("Income:Rent", 500)
        .commit();
    }

    it("should give you the balance", async () => {
      const book = new Book("MyBook-balance");
      await addBalance(book);

      const data = await book.balance({ account: "Assets" });
      expect(data.balance).to.be.equal(-1200);
    });

    it("should give you the balance with partial meta queries", async () => {
      const book = new Book("MyBook-balance with meta");
      await addBalance(book);

      const data1 = await book.balance({ account: "Assets:Receivable", clientId: "67890" });
      expect(data1.balance).to.be.equal(-700);
      const data2 = await book.balance({ account: "Assets:Receivable", clientId: "12345" });
      expect(data2.balance).to.be.equal(-500);
    });

    it("should give you the balance without providing the account", async () => {
      const book = new Book("MyBook-balance-no-account");
      await addBalance(book);

      const data = await book.balance({});
      expect(data.balance).to.be.equal(0);

      const snapshots = await balanceModel.find({ book: book.name });
      expect(snapshots).to.have.length(1);
      expect(snapshots[0].balance).to.equal(0);
    });

    it("should give you the total balance for multiple accounts", async () => {
      const book = new Book("MyBook-balance-multiple");
      await addBalance(book);

      const data = await book.balance({ account: ["Assets", "Income"] });
      expect(data.balance).to.be.equal(0);
    });

    it("should reuse the snapshot balance", async () => {
      const book = new Book("MyBook-balance-snapshot");
      await addBalance(book);

      await book.balance({ account: "Assets" });

      const snapshots = await balanceModel.find({ account: "Assets", book: book.name });
      expect(snapshots).to.have.length(1);
      expect(snapshots[0].balance).to.equal(-1200);

      snapshots[0].balance = 999;
      await snapshots[0].save();

      const data = await book.balance({ account: "Assets" });
      expect(data.balance).to.equal(999);
    });

    it("should reuse the snapshot balance when meta is in the query", async () => {
      const book = new Book("MyBook-balance-snapshot-with-meta");
      await addBalance(book);

      await book.balance({ account: "Assets", clientId: "12345" });

      const snapshots = await balanceModel.find({
        account: "Assets",
        book: book.name,
        meta: JSON.stringify({ clientId: "12345" }),
      });
      expect(snapshots).to.have.length(1);
      expect(snapshots[0].balance).to.equal(-500);
      expect(snapshots[0].meta).to.equal('{"clientId":"12345"}');

      snapshots[0].balance = 999;
      await snapshots[0].save();

      const data = await book.balance({ account: "Assets", clientId: "12345" });
      expect(data.balance).to.equal(999);
    });

    it("should create only one snapshot document", async () => {
      const book = new Book("MyBook-balance-snapshot-count");
      await addBalance(book);

      await book.balance({ account: "Assets", clientId: "12345" });
      await book.balance({ account: "Assets", clientId: "12345" });
      await book.balance({ account: "Assets", clientId: "12345" });

      const snapshots = await balanceModel.find({
        account: "Assets",
        book: book.name,
        meta: JSON.stringify({ clientId: "12345" }),
      });
      expect(snapshots).to.have.length(1);
      expect(snapshots[0].balance).to.equal(-500);
      expect(snapshots[0].meta).to.equal('{"clientId":"12345"}');
    });

    it("should create periodic balance snapshot document", async () => {
      const howOften = 50; // milliseconds
      const book = new Book("MyBook-balance-snapshot-periodic", { balanceSnapshotSec: howOften / 1000 });

      await addBalance(book);
      await book.balance({ account: "Assets" });
      // Should be one snapshot.
      let snapshots = await balanceModel.find({ account: "Assets", book: book.name });
      expect(snapshots.length).to.equal(1);
      expect(snapshots[0].balance).to.equal(-1200);

      await delay(howOften + 1); // wait long enough to create a second periodic snapshot
      await addBalance(book);
      await book.balance({ account: "Assets" });
      await delay(10); // wait until the full balance snapshot is recalculated in the background
      // Should be two snapshots now.
      snapshots = await balanceModel.find({ account: "Assets", book: book.name });
      expect(snapshots.length).to.equal(2);
      expect(snapshots[0].balance).to.equal(-1200);
      expect(snapshots[1].balance).to.equal(-2400);
    });

    it("should not do balance snapshots if turned off", async () => {
      const book = new Book("MyBook-balance-snapshot-off", { balanceSnapshotSec: 0 });
      await addBalance(book);

      await book.balance({ account: "Assets" });

      const snapshots = await balanceModel.find({ account: "Assets", book: book.name });
      expect(snapshots).to.have.length(0);
    });

    it("should reuse the snapshot balance in multi account query", async () => {
      const book = new Book("MyBook-balance-multiple-snapshot");
      await addBalance(book);

      await book.balance({ account: ["Assets", "Income"] });

      const snapshots = await balanceModel.find({ account: ["Assets", "Income"].join(), book: book.name });
      expect(snapshots).to.have.length(1);
      expect(snapshots[0].balance).to.equal(0);

      snapshots[0].balance = 999;
      await snapshots[0].save();

      const data = await book.balance({ account: ["Assets", "Income"] });
      expect(data.balance).to.equal(999);
    });

    it("should deal with JavaScript rounding weirdness", async function () {
      const book = new Book("MyBook-balance-rounding");
      await book.entry("Rounding Test").credit("A:B", 1005).debit("A:B", 994.95).debit("A:B", 10.05).commit();
      const result1 = await book.balance({ account: "A:B" });
      const { balance } = result1;
      expect(balance).to.be.equal(0);
    });

    it("should have updated the balance for assets and income and accurately give balance for subaccounts", async () => {
      const book = new Book("MyBook-balance-sub");
      await addBalance(book);

      {
        const data = await book.balance({
          account: "Assets",
        });
        const { notes, balance } = data;
        expect(notes).to.be.equal(2);
        expect(balance).to.be.equal(-1200);
      }
      {
        const data1 = await book.balance({ account: "Assets:Receivable" });
        const { notes, balance } = data1;
        expect(balance).to.be.equal(-1200);
        expect(notes).to.be.equal(2);
      }
      {
        const data2 = await book.balance({
          account: "Assets:Other",
        });
        const { notes, balance } = data2;
        expect(balance).to.be.equal(0);
        expect(notes).to.be.equal(0);
      }
    });
  });

  describe("journal.void", () => {
    const book = new Book("MyBook-journal-void");
    let journal:
      | (Document &
          IJournal & {
            _original_journal?: Types.ObjectId;
          })
      | null = null;

    before(async () => {
      await book.entry("Test Entry").debit("Assets:Receivable", 700).credit("Income:Rent", 700).commit();
      journal = await book
        .entry("Test Entry")
        .debit("Assets:Receivable", 500, { clientId: "12345" })
        .credit("Income:Rent", 500)
        .commit();
    });

    it("should throw an JournalNotFoundError if journal does not exist", async () => {
      try {
        await book.void(new Types.ObjectId());
        expect.fail("Should have thrown.");
      } catch (e) {
        expect(e).to.be.instanceOf(JournalNotFoundError);
      }
    });

    it("should throw an JournalNotFoundError if journal does not exist in book", async () => {
      const anotherBook = new Book("AnotherBook");

      const anotherJournal = await anotherBook
        .entry("Test Entry")
        .debit("Assets:Receivable", 700)
        .credit("Income:Rent", 700)
        .commit();
      try {
        await book.void(anotherJournal._id);
        expect.fail("Should have thrown.");
      } catch (e) {
        expect(e).to.be.instanceOf(JournalNotFoundError);
      }
    });

    it("should allow you to void a journal entry", async () => {
      if (!journal) {
        expect.fail("journal missing.");
      }
      const data = await book.balance({
        account: "Assets",
        clientId: "12345",
      });
      expect(data.balance).to.be.equal(-500);

      await book.void(journal._id, "Messed up");
      const clientAccount = await book.balance({
        account: "Assets",
        clientId: "12345",
      });
      expect(clientAccount.balance).to.be.equal(0);
      const data1 = await book.balance({
        account: "Assets",
      });
      expect(data1.balance).to.be.equal(-700);

      const data2 = await book.balance({
        account: "Assets",
        clientId: "12345",
      });
      expect(data2.balance).to.be.equal(0);
    });

    it("should throw an error if journal was already voided", async () => {
      if (!journal) {
        expect.fail("journal missing.");
      }
      try {
        await book.void(journal._id, "Messed up");
        expect.fail("Should have thrown.");
      } catch (e) {
        expect((e as Error).message).to.be.equal("Journal already voided.");
      }
    });

    it("should create the correct memo fields when reason is given", async () => {
      const journal = await book
        .entry("Test Entry")
        .debit("Assets:Receivable", 700)
        .credit("Income:Rent", 700)
        .commit();

      const voidedJournal = await book.void(journal._id, "Void reason");

      const updatedJournal = (await book.ledger({ _journal: journal._id })).results[0];

      expect(updatedJournal.memo).to.be.equal("Test Entry");
      expect(updatedJournal.void_reason).to.be.equal("Void reason");

      expect(voidedJournal.memo).to.be.equal("Void reason");
      expect(voidedJournal.void_reason).to.be.equal(undefined);
    });

    it("should create the correct memo fields when reason was not given", async () => {
      const journal = await book
        .entry("Test Entry")
        .debit("Assets:Receivable", 700)
        .credit("Income:Rent", 700)
        .commit();

      const voidedJournal = await book.void(journal._id);

      const updatedJournal = (await book.ledger({ _journal: journal._id })).results[0];

      expect(updatedJournal.memo).to.be.equal("Test Entry");
      expect(updatedJournal.void_reason).to.be.equal("[VOID] Test Entry");

      expect(voidedJournal.memo).to.be.equal("[VOID] Test Entry");
      expect(voidedJournal.void_reason).to.be.equal(undefined);
    });
  });

  describe("listAccounts", () => {
    it("should list all accounts", async () => {
      const book = new Book("MyBook-listAccounts");
      await book.entry("listAccounts test").credit("Assets:Receivable", 1).debit("Income:Rent", 1).commit();

      const accounts = await book.listAccounts();
      expect(accounts).to.have.lengthOf(4);
      expect(accounts).to.have.members(["Assets", "Assets:Receivable", "Income", "Income:Rent"]);
    });

    it("should list accounts with 1 and 3 path parts", async () => {
      const book = new Book("MyBook-listAccounts path parts");
      await book.entry("listAccounts test 2").credit("Assets", 1).debit("Income:Rent:Taxable", 1).commit();

      const accounts = await book.listAccounts();
      expect(accounts).to.have.lengthOf(4);
      expect(accounts).to.have.members(["Assets", "Income", "Income:Rent", "Income:Rent:Taxable"]);
    });
  });

  describe("ledger", () => {
    const book = new Book("MyBook-ledger");
    before(async () => {
      await book.entry("ledger test 1").credit("Assets:Receivable", 1).debit("Income:Rent", 1).commit();

      await book.entry("ledger test 2").debit("Income:Rent", 1).credit("Assets:Receivable", 1).commit();

      await book.entry("ledger test 3").debit("Income:Rent", 1).credit("Assets:Receivable", 1).commit();
    });

    it("should return full ledger", async () => {
      const res = await book.ledger({ account: "Assets" });
      expect(res.results).to.have.lengthOf(3);
    });

    it("should return full ledger with hydrated objects when lean is not set", async () => {
      const res = await book.ledger({ account: "Assets" });
      expect(res.results).to.have.lengthOf(3);
      expect(res.results[0]).to.not.have.property("_doc");
      expect(res.results[1]).to.not.have.property("_doc");
      expect(res.results[2]).to.not.have.property("_doc");
    });

    it("should return full ledger with just ObjectId of the _journal attribute", async () => {
      const res = await book.ledger({ account: "Assets" });
      expect(res.results).to.have.lengthOf(3);
      expect(res.results[0]._journal).to.be.instanceof(Types.ObjectId);
      expect(res.results[1]._journal).to.be.instanceof(Types.ObjectId);
      expect(res.results[2]._journal).to.be.instanceof(Types.ObjectId);
    });

    it("should return ledger with array of accounts", async () => {
      const res = await book.ledger({ account: ["Assets", "Income"] });
      expect(res.results).to.have.lengthOf(6);
      let assets = 0;
      let income = 0;
      for (const result of res.results) {
        if (result.account_path.includes("Assets")) {
          assets++;
        }
        if (result.account_path.includes("Income")) {
          income++;
        }
      }
      expect(assets).to.be.equal(3);
      expect(income).to.be.equal(3);
    });

    it("should give you a paginated ledger when requested", async () => {
      const response = await book.ledger({
        account: ["Assets", "Income"],
        perPage: 2,
        page: 3,
      });
      expect(response.results).to.have.lengthOf(2);
      expect(response.total).to.be.equal(6);
      expect(response.results[0].memo).to.be.equal("ledger test 1");
      expect(response.results[1].memo).to.be.equal("ledger test 1");
    });

    it("should give you a paginated ledger when requested and start by page 1 if page is not defined", async () => {
      const response = await book.ledger({
        account: ["Assets", "Income"],
        perPage: 2,
      });
      expect(response.results).to.have.lengthOf(2);
      expect(response.total).to.be.equal(6);
      expect(response.results[0].memo).to.be.equal("ledger test 3");
      expect(response.results[1].memo).to.be.equal("ledger test 3");
    });

    it("should give you a paginated ledger when requested and start by page 1 if page is defined", async () => {
      const response = await book.ledger({
        account: ["Assets", "Income"],
        perPage: 2,
        page: 1,
      });
      expect(response.results).to.have.lengthOf(2);
      expect(response.total).to.be.equal(6);
      expect(response.results[0].memo).to.be.equal("ledger test 3");
      expect(response.results[1].memo).to.be.equal("ledger test 3");
    });

    it("should retrieve transactions by time range", async () => {
      const book = new Book("MyBook_time_range");
      await book
        .entry("Test Entry")
        .debit("Assets:Receivable", 500, { clientId: "12345" })
        .credit("Income:Rent", 500)
        .commit();
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      await book
        .entry("Test Entry 2", threeDaysAgo)
        .debit("Assets:Receivable", 700)
        .credit("Income:Rent", 700)
        .commit();

      const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
      const endDate = new Date(); // today

      const { total } = await book.ledger({
        account: "Income",
        start_date: fourDaysAgo,
        end_date: endDate,
      });

      expect(total).to.be.equal(2);
    });
  });
});

/* eslint sonarjs/no-duplicate-string: off, no-prototype-builtins: off*/
import { expect } from "chai";
import { Book } from "../src";
import { getBestSnapshot } from "../src/models/balance";

describe("balance model", function () {
  describe("getBestSnapshot", () => {
    it("should find snapshot", async function () {
      const book = new Book("MyBook-balance-1");

      await book.entry("Test 1").credit("Assets:Receivable", 1).debit("Income:Rent", 1).commit();

      const balance1 = await book.balance({ account: "Assets:Receivable" });
      expect(balance1).to.deep.equal({ balance: 1, notes: 1 });

      const snapshot = await getBestSnapshot({ book: book.name, account: "Assets:Receivable" });
      expect(snapshot).to.have.property("balance", 1);
    });

    it("should return proper number of notes", async function () {
      const book = new Book("MyBook-balance-notes");

      await book.entry("Test 1").credit("Assets:Receivable", 1).debit("Income:Rent", 1).commit();

      const balance1 = await book.balance({ account: "Assets:Receivable" });
      expect(balance1).to.deep.equal({ balance: 1, notes: 1 });

      const balance2 = await book.balance({ account: "Assets:Receivable" });
      expect(balance2).to.deep.equal({ balance: 1, notes: 1 });

      await book.entry("Test 1").credit("Assets:Receivable", 1).debit("Income:Rent", 1).commit();

      const balance3 = await book.balance({ account: "Assets:Receivable" });
      expect(balance3).to.deep.equal({ balance: 2, notes: 2 });
    });

    it("should not confuse snapshots", async function () {
      const book = new Book("MyBook-balance-2");

      const meta = { clientId: "12345", otherMeta: 1 };
      await book.entry("T2E1").credit("Assets:Receivable", 1, meta).debit("Income:Rent", 1, meta).commit();
      await book.entry("T2E2").credit("Assets:Receivable", 2).debit("Income:Rent", 2).commit();

      let balance, snapshot;

      // should create a balance with meta
      balance = await book.balance({ account: "Assets:Receivable", clientId: "12345" });
      expect(balance).to.deep.equal({ balance: 1, notes: 1 });

      // balance with meta should equal 1.0
      snapshot = await getBestSnapshot({ book: book.name, account: "Assets:Receivable", meta: { clientId: "12345" } });
      expect(snapshot).to.have.property("balance", 1);

      // there must be no balance without meta (yet)
      snapshot = await getBestSnapshot({ book: book.name, account: "Assets:Receivable" });
      expect(snapshot).to.be.not.ok;

      // this should create a new balance
      balance = await book.balance({ account: "Assets:Receivable" });
      expect(balance).to.deep.equal({ balance: 3, notes: 2 });

      // check if previously missing balance was created and equals to 3.0
      snapshot = await getBestSnapshot({ book: book.name, account: "Assets:Receivable" });
      expect(snapshot).to.have.property("balance", 3);
    });

    it("should not confuse snapshots - reverse querying", async function () {
      const book = new Book("MyBook-balance-3");

      const meta = { clientId: "12345", otherMeta: 1 };
      await book.entry("T2E1").credit("Assets:Receivable", 1, meta).debit("Income:Rent", 1, meta).commit();
      await book.entry("T2E2").credit("Assets:Receivable", 2).debit("Income:Rent", 2).commit();

      let balance, snapshot;

      // should create a balance without meta
      balance = await book.balance({ account: "Assets:Receivable" });
      expect(balance).to.deep.equal({ balance: 3, notes: 2 });

      // balance without meta should equal 3.0
      snapshot = await getBestSnapshot({ book: book.name, account: "Assets:Receivable" });
      expect(snapshot).to.have.property("balance", 3);

      // there must be no balance with meta (yet)
      snapshot = await getBestSnapshot({ book: book.name, account: "Assets:Receivable", meta: { clientId: "12345" } });
      expect(snapshot).to.be.not.ok;

      // this should create a new balance, this time with meta
      balance = await book.balance({ account: "Assets:Receivable", clientId: "12345" });
      expect(balance).to.deep.equal({ balance: 1, notes: 1 });

      // check if previously missing balance was created and equals to 1.0
      snapshot = await getBestSnapshot({ book: book.name, account: "Assets:Receivable", meta: { clientId: "12345" } });
      expect(snapshot).to.have.property("balance", 1);
    });
  });
});

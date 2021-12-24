/* eslint sonarjs/no-duplicate-string: off, no-prototype-builtins: off*/
import { expect } from "chai";
import { Book } from "../src/Book";

describe("fpPrecision", function () {
  describe("fpPrecision - default: fp-Mode 8", () => {
    it("should store a commit without errors", async function () {
      const book = new Book("MyBook-fpPrecision-8");

      await book
        .entry("Test fp")
        .credit("Assets:Receivable", 0.1)
        .credit("Assets:Receivable", 0.2)
        .debit("Income:Rent", 0.1)
        .debit("Income:Rent", 0.2)
        .commit();

      const result1 = await book.balance({
        account: "Assets:Receivable",
      });

      expect(result1.notes).to.be.equal(2);
      expect(result1.balance).to.be.equal(0.3);

      const result2 = await book.balance({
        account: "Income:Rent",
      });

      expect(result2.notes).to.be.equal(2);
      expect(result2.balance).to.be.equal(-0.3);
    });
  });

  describe("fpPrecision - fp-Mode 7", () => {
    it("should store a commit without errors", async function () {
      const book = new Book("MyBook-fpPrecision-7", { precision: 7 });

      await book
        .entry("Test fp")
        .credit("Assets:Receivable", 0.0000001)
        .credit("Assets:Receivable", 0.0000002)
        .debit("Income:Rent", 0.0000001)
        .debit("Income:Rent", 0.0000002)
        .debit("Assets:Rent", 0.0000003)
        .credit("Assets:Rent", 0.0000001)
        .credit("Assets:Black", 0.0000002)
        .commit();

      const result1 = await book.balance({
        account: "Assets:Receivable",
      });

      expect(result1.notes).to.be.equal(2);
      expect(result1.balance).to.be.equal(0.0000003);

      const result2 = await book.balance({
        account: "Income:Rent",
      });

      expect(result2.notes).to.be.equal(2);
      expect(result2.balance).to.be.equal(-0.0000003);

      const result3 = await book.balance({
        account: "Assets:Rent",
      });

      expect(result3.notes).to.be.equal(2);
      expect(result3.balance).to.be.equal(-0.0000002);
    });
  });

  describe("fpPrecision - integer-Mode", () => {
    it("should store a journal without error", async function () {
      const book = new Book("MyBook-integer", { precision: 0 });

      await book
        .entry("Test fp")
        .credit("Assets:Receivable", 1.1)
        .credit("Assets:Receivable", 1.2)
        .debit("Income:Rent", 1.1)
        .debit("Income:Rent", 1.2)
        .commit();

      const result1 = await book.balance({
        account: "Assets:Receivable",
      });

      expect(result1.notes).to.be.equal(2);
      expect(result1.balance).to.be.equal(2);

      const result2 = await book.balance({
        account: "Income:Rent",
      });

      expect(result2.notes).to.be.equal(2);
      expect(result2.balance).to.be.equal(-2);
    });
  });
});

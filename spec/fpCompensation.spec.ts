/* eslint sonarjs/no-duplicate-string: off, no-prototype-builtins: off*/
import { expect } from "chai";
import { Book } from "../src/Book";

describe("fpCompensation", function () {
  describe("fpCompensation - default: fp-Mode 7", () => {
    const book = new Book("MyBook-fpCompensation-7");

    it("should store a journal without error", async function () {
      await book
        .entry("Test fp")
        .credit("Assets:Receivable", 0.1)
        .credit("Assets:Receivable", 0.2)
        .debit("Income:Rent", 0.1)
        .debit("Income:Rent", 0.2)
        .commit();
    });

    it("should get balance of a credit-account", async function () {
      const result = await book.balance({
        account: "Assets:Receivable",
      });

      expect(result.notes).to.be.equal(2);
      expect(result.balance).to.be.equal(0.3);
    });

    it("should get balance of a debit-account", async function () {
      const result = await book.balance({
        account: "Income:Rent",
      });

      expect(result.notes).to.be.equal(2);
      expect(result.balance).to.be.equal(-0.3);
    });
  });

  describe("fpCompensation - fp-Mode 8", () => {
    const book = new Book("MyBook-fpCompensation-8", { precision: 8 });

    it("should store a journal without error", async function () {
      await book
        .entry("Test fp")
        .credit("Assets:Receivable", 0.00000001)
        .credit("Assets:Receivable", 0.00000002)
        .debit("Income:Rent", 0.00000001)
        .debit("Income:Rent", 0.00000002)
        .debit("Assets:Rent", 0.00000003)
        .credit("Assets:Rent", 0.00000001)
        .credit("Assets:Black", 0.00000002)
        .commit();
    });

    it("should get balance of a credit-account", async function () {
      const result = await book.balance({
        account: "Assets:Receivable",
      });

      expect(result.notes).to.be.equal(2);
      expect(result.balance).to.be.equal(0.00000003);
    });

    it("should get balance of a debit-account", async function () {
      const result = await book.balance({
        account: "Income:Rent",
      });

      expect(result.notes).to.be.equal(2);
      expect(result.balance).to.be.equal(-0.00000003);
    });

    it("should get balance of a debit-account", async function () {
      const result = await book.balance({
        account: "Assets:Rent",
      });

      expect(result.notes).to.be.equal(2);
      expect(result.balance).to.be.equal(-0.00000002);
    });
  });

  describe("fpCompensation - integer-Mode", () => {
    const book = new Book("MyBook-integer", { precision: 0 });

    it("should store a journal without error", async function () {
      await book
        .entry("Test fp")
        .credit("Assets:Receivable", 1.1)
        .credit("Assets:Receivable", 1.2)
        .debit("Income:Rent", 1.1)
        .debit("Income:Rent", 1.2)
        .commit();
    });

    it("should get balance of a credit-account", async function () {
      const result = await book.balance({
        account: "Assets:Receivable",
      });

      expect(result.notes).to.be.equal(2);
      expect(result.balance).to.be.equal(2);
    });

    it("should get balance of a debit-account", async function () {
      const result = await book.balance({
        account: "Income:Rent",
      });

      expect(result.notes).to.be.equal(2);
      expect(result.balance).to.be.equal(-2);
    });
  });
});

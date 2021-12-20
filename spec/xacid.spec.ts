/* eslint sonarjs/no-duplicate-string: off, sonarjs/no-identical-functions: off */
import { Book } from "../src/Book";
import { expect } from "chai";
import * as mongoose from "mongoose";
import { initModels, mongoTransaction } from "../src";

describe("acid", function () {
  before(async () => {
    await initModels();
  });

  it("should not persist data when saving journal fails while using a session", async function () {
    const book = new Book("ACID" + Date.now());

    try {
      await mongoose.connection.transaction(async (session) => {
        await book
          .entry("depth test")
          .credit("X:Y:AUD", 1)
          .credit("X:Y:EUR", 1)
          .credit("X:Y:USD", 1)
          .credit("X:Y:INR", 1)
          // @ts-expect-error mongoose validator should throw an error
          .credit("X:Y:CHF", 1, { timestamp: "invalid " })
          .debit("CashAssets", 5)
          .commit({ session });
      });
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as Error).message).match(
        /Medici_Transaction validation failed/
      );
    }

    const result = await book.balance({ account: "X:Y" });
    expect(result.balance).to.be.equal(0);
  });

  it("check if mongoTransaction is working as an alias", async function () {
    const book = new Book("ACID" + Date.now());

    try {
      await mongoTransaction(async (session) => {
        await book
          .entry("depth test")
          .credit("X:Y:AUD", 1)
          .credit("X:Y:EUR", 1)
          .credit("X:Y:USD", 1)
          .credit("X:Y:INR", 1)
          // @ts-expect-error mongoose validator should throw an error
          .credit("X:Y:CHF", 1, { timestamp: "invalid " })
          .debit("CashAssets", 5)
          .commit({ session });
      });
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as Error).message).match(
        /Medici_Transaction validation failed/
      );
    }

    const result = await book.balance({ account: "X:Y" });
    expect(result.balance).to.be.equal(0);
  });

  it("should persist data while using a session", async function () {
    const book = new Book("ACID" + Date.now());

    await mongoose.connection.transaction(async (session) => {
      await book
        .entry("depth test")
        .credit("X:Y:AUD", 1)
        .credit("X:Y:EUR", 1)
        .credit("X:Y:USD", 1)
        .credit("X:Y:INR", 1)
        .credit("X:Y:CHF", 1)
        .debit("CashAssets", 5)
        .commit({ session });
    });

    const result = await book.balance({ account: "X:Y" });
    expect(result.balance).to.be.equal(5);
  });

  it("should not persist data if we throw an Error while using a session", async function () {
    const book = new Book("ACID" + Date.now());

    try {
      await mongoose.connection.transaction(async (session) => {
        await book
          .entry("depth test")
          .credit("X:Y:AUD", 1)
          .credit("X:Y:EUR", 1)
          .credit("X:Y:USD", 1)
          .credit("X:Y:INR", 1)
          .credit("X:Y:CHF", 1)
          .debit("CashAssets", 5)
          .commit({ session });

        const { balance } = await book.balance(
          {
            account: "X:Y:CHF",
          },
          { session }
        );

        if (balance <= 2) {
          throw new Error("Not enough Balance.");
        }
      });
    } catch (e) {
      expect((e as Error).message).to.be.equal("Not enough Balance.");
    }

    const result = await book.balance({ account: "X:Y" });
    expect(result.balance).to.be.equal(0);
  });

  it("should pass a stresstest when persisting data while using a session", async function () {
    this.timeout(10000);
    for (let i = 0, il = 100; i < il; i++) {
      const book = new Book("ACID" + Date.now());

      await mongoose.connection.transaction(async (session) => {
        await book
          .entry("depth test")
          .credit("X:Y:AUD", 1)
          .credit("X:Y:EUR", 1)
          .credit("X:Y:USD", 1)
          .credit("X:Y:INR", 1)
          .credit("X:Y:CHF", 1)
          .debit("CashAssets", 5)
          .commit({ session });
      });

      const result = await book.balance({ account: "X:Y" });
      expect(result.balance).to.be.equal(5);
    }
  });

  it("should pass a stresstest when voiding while using a session", async function () {
    this.timeout(10000);

    for (let i = 0, il = 100; i < il; i++) {
      const book = new Book("ACID" + Date.now());

      const journal = await book
        .entry("depth test")
        .credit("X:Y:AUD", 1)
        .credit("X:Y:EUR", 1)
        .credit("X:Y:USD", 1)
        .credit("X:Y:INR", 1)
        .credit("X:Y:CHF", 1)
        .debit("CashAssets", 5)
        .commit();

      await mongoose.connection.transaction(async (session) => {
        await journal.void(book, null, { session });
      });

      const result = await book.balance({ account: "X:Y" });
      expect(result.balance).to.be.equal(0);
    }
  });

  it("should pass a stresstest for erroring when commiting", async function () {
    this.timeout(10000);
    const book = new Book("ACID" + Date.now());

    for (let i = 0, il = 100; i < il; i++) {
      try {
        await mongoose.connection.transaction(async (session) => {
          await book
            .entry("depth test")
            .credit("X:Y:AUD", 1)
            .credit("X:Y:EUR", 1)
            .credit("X:Y:USD", 1)
            .credit("X:Y:INR", 1)
            .credit("X:Y:CHF", 1)
            .debit("CashAssets", 5)
            .commit({ session });

          const { balance } = await book.balance(
            {
              account: "X:Y:CHF",
            },
            { session }
          );

          if (balance <= 2) {
            throw new Error("Not enough Balance.");
          }
        });
      } catch (e) {
        expect((e as Error).message).to.be.equal("Not enough Balance.");
      }
    }

    const result = await book.balance({ account: "X:Y" });
    expect(result.balance).to.be.equal(0);
  });

  it("should pass a stresstest for erroring when voiding", async function () {
    this.timeout(10000);
    const book = new Book("ACID" + Date.now());

    const journal = await book
      .entry("depth test")
      .credit("X:Y:AUD", 1)
      .credit("X:Y:EUR", 1)
      .credit("X:Y:USD", 1)
      .credit("X:Y:INR", 1)
      .credit("X:Y:CHF", 1)
      .debit("CashAssets", 5)
      .commit();

    for (let i = 0, il = 100; i < il; i++) {
      try {
        await mongoose.connection.transaction(async (session) => {
          await journal.void(book, null, { session });
          throw new Error("Journaling failed.");
        });
      } catch (e) {
        expect((e as Error).message).to.be.equal("Journaling failed.");
      }
      journal.voided = false;
    }

    const result = await book.balance({ account: "X:Y" });
    expect(result.balance).to.be.equal(5);
  });

  it("should pass a stresstest for approving", async function () {
    this.timeout(10000);
    const book = new Book("ACID" + Date.now());

    for (let i = 0, il = 100; i < il; i++) {
      const journal = await book
        .entry("depth test")
        .credit("X:Y:AUD", 1)
        .credit("X:Y:EUR", 1)
        .credit("X:Y:USD", 1)
        .credit("X:Y:INR", 1)
        .credit("X:Y:CHF", 1)
        .debit("CashAssets", 5)
        .setApproved(false)
        .commit();

      await mongoose.connection.transaction(async (session) => {
        journal.approved = true;
        await journal.save({ session });
      });
    }
    const result = await book.balance({ account: "X:Y" });
    expect(result.balance).to.be.equal(500);
  });

  it("should pass a stresstest for erroring when approving", async function () {
    this.timeout(10000);
    const book = new Book("ACID" + Date.now());

    for (let i = 0, il = 100; i < il; i++) {
      const journal = await book
        .entry("depth test")
        .credit("X:Y:AUD", 1)
        .credit("X:Y:EUR", 1)
        .credit("X:Y:USD", 1)
        .credit("X:Y:INR", 1)
        .credit("X:Y:CHF", 1)
        .debit("CashAssets", 5)
        .setApproved(false)
        .commit();
      try {
        await mongoose.connection.transaction(async (session) => {
          journal.approved = true;
          await journal.save({ session });
          throw new Error("Approving Failed.");
        });
      } catch (e) {
        expect((e as Error).message).to.be.equal("Approving Failed.");
      }
    }
    const result = await book.balance({ account: "X:Y" });
    expect(result.balance).to.be.equal(0);
  });
});

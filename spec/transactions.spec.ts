/* eslint sonarjs/no-duplicate-string: off, sonarjs/no-identical-functions: off */
import { Book } from "../src/Book";
import { assert } from "chai";
import * as mongoose from "mongoose";

describe("Transactions", function () {
  it("should persist data while using a session", async function () {
    const book = new Book("LSD");

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
    assert.strictEqual(result.balance, 5);
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
      assert((e as Error).message === "Not enough Balance.");
    }

    const result = await book.balance({ account: "X:Y" });
    assert.strictEqual(result.balance, 0);
  });

  it("should pass a stresstest when persisting data while using a session", async function () {
    this.timeout(10000);
    for (let i = 0, il = 100; i < il; i++) {
      const book = new Book("LSD" + Date.now());

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
      if (result.balance !== 5) {
        console.log(await book.ledger({ account: "X:Y" }));
      }
      assert.strictEqual(result.balance, 5);
    }
  });

  it("should pass a stresstest when voiding while using a session", async function () {
    this.timeout(10000);

    for (let i = 0, il = 100; i < il; i++) {
      const book = new Book("LSD" + Date.now());

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
      assert.strictEqual(result.balance, 0);
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
        assert((e as Error).message === "Not enough Balance.");
      }
    }

    const result = await book.balance({ account: "X:Y" });
    assert.strictEqual(result.balance, 0);
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
        assert((e as Error).message === "Journaling failed.");
      }
      journal.voided = false;
    }

    const result = await book.balance({ account: "X:Y" });
    assert.strictEqual(result.balance, 5);
  });
});

/* eslint sonarjs/no-duplicate-string: off, sonarjs/no-identical-functions: off */
import { Book } from "../src/Book";
import { assert } from "chai";
import * as mongoose from "mongoose";

describe("Transactions", function () {
  it("should persist data if while using a session", async function () {
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
    const book = new Book("ACID");

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

  it("should pass a stresstest", async function () {
    const book = new Book("ACID");

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
});

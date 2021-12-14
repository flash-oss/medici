import { Book } from "../src/Book";
import { assert } from "chai";
import * as mongoose from "mongoose";

// We can not run Transactions on Mongo 3.6
if (process.env.CI !== "true" || process.env.MV !== "3.6") {
  describe("ACID", function () {
    it("should not persist data if we throw an Error while using a session", async function () {
      const book = new Book("LSD");

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
        assert(e.message === "Not enough Balance.");
      }

      const result = await book.balance({ account: "X:Y" });
      assert.strictEqual(result.balance, 0);
    });

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
  });
}

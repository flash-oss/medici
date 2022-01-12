/* eslint sonarjs/no-duplicate-string: off, sonarjs/no-identical-functions: off */
import { Book } from "../src/Book";
import { expect } from "chai";
import * as mongoose from "mongoose";
import { initModels, mongoTransaction } from "../src";
import { lockModel } from "../src/models/lock";
import delay from "./helper/delay";

if (process.env.ACID_AVAILABLE) {
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
            .credit("X:Y:CHF", 1, { datetime: "invalid" })
            .debit("CashAssets", 5)
            .commit({ session });
        });
        expect.fail("Should have thrown.");
      } catch (e) {
        expect((e as Error).message).match(/Medici_Transaction validation failed/);
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
            .credit("X:Y:CHF", 1, { datetime: "invalid" })
            .debit("CashAssets", 5)
            .commit({ session });
        });
        expect.fail("Should have thrown.");
      } catch (e) {
        expect((e as Error).message).match(/Medici_Transaction validation failed/);
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

      for (let i = 0; i < 100; i++) {
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

      for (let i = 0; i < 100; i++) {
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
          await book.void(journal._id, null, { session });
        });

        const result = await book.balance({ account: "X:Y" });
        expect(result.balance).to.be.equal(0);
      }
    });

    it("should pass a stresstest for erroring when committing", async function () {
      this.timeout(10000);

      const book = new Book("ACID" + Date.now());

      for (let i = 0; i < 100; i++) {
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

      for (let i = 0; i < 100; i++) {
        try {
          await mongoose.connection.transaction(async (session) => {
            await book.void(journal._id, null, { session });
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

    it("should avoid double spending, commit() using writelockAccounts", async function () {
      const book = new Book("ACID" + Date.now());

      await book.entry("depth test").credit("Income", 2).debit("Outcome", 2).commit();

      async function spendOne(session: mongoose.ClientSession, name: string, pause: number) {
        await book
          .entry("depth test")
          .credit("Savings", 1)
          .debit("Income", 1)
          .commit({ session, writelockAccounts: ["Income"] });

        await delay(pause);

        const result = await book.balance(
          {
            account: "Income",
          },
          { session }
        );
        if (result.balance < 0) {
          throw new Error("Not enough Balance in " + name + " transaction.");
        }
      }

      await Promise.allSettled([
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
      ]);

      const result = await book.balance({ account: "Income" });
      expect(result.balance).to.be.equal(0);
    });

    it("should avoid double spending, commit() using writelockAccounts with a Regex", async function () {
      const book = new Book("ACID" + Date.now());

      await book.entry("depth test").credit("Income", 2).debit("Outcome", 2).commit();

      async function spendOne(session: mongoose.ClientSession, name: string, pause: number) {
        await book
          .entry("depth test")
          .credit("Savings", 1)
          .debit("Income", 1)
          .commit({ session, writelockAccounts: /Income/ });

        await delay(pause);

        const result = await book.balance(
          {
            account: "Income",
          },
          { session }
        );
        if (result.balance < 0) {
          throw new Error("Not enough Balance in " + name + " transaction.");
        }
      }

      await Promise.allSettled([
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
      ]);

      const result = await book.balance({ account: "Income" });
      expect(result.balance).to.be.equal(0);
    });

    it("should avoid double spending, using book.writelockAccounts", async function () {
      const book = new Book("ACID" + Date.now());

      await book.entry("depth test").credit("Income", 2).debit("Outcome", 2).commit();

      async function spendOne(session: mongoose.ClientSession, name: string, pause: number) {
        await book.entry("depth test").credit("Savings", 1).debit("Income", 1).commit({ session });

        await delay(pause);

        const result = await book.balance(
          {
            account: "Income",
          },
          { session }
        );
        if (result.balance < 0) {
          throw new Error("Not enough Balance in " + name + " transaction.");
        }

        await book.writelockAccounts(["Income"], { session });
      }

      await Promise.allSettled([
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
      ]);

      const result = await book.balance({ account: "Income" });
      expect(result.balance).to.be.equal(0);
    });

    it("should create correct locks", async function () {
      const book = new Book("ACID" + Date.now());

      await lockModel.deleteMany({}).exec();

      const beginDate = new Date();

      await book.entry("depth test").credit("Income", 2).debit("Outcome", 2).commit();

      async function spendOne(session: mongoose.ClientSession, name: string, pause: number) {
        await book.entry("depth test").credit("Savings", 1).debit("Income", 1).commit({ session });

        await delay(pause);

        const result = await book.balance(
          {
            account: "Income",
          },
          { session }
        );
        if (result.balance < 0) {
          throw new Error("Not enough Balance in " + name + " transaction.");
        }

        await book.writelockAccounts(["Income"], { session });
      }

      await Promise.allSettled([
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
        mongoose.connection.transaction(async (session) => {
          await spendOne(session, "concurrent", 0);
        }),
      ]);

      const locks = await lockModel.find({}).lean().exec();

      expect(locks).to.have.lengthOf(1);
      expect(locks[0].book).to.be.equal(book.name);
      expect(locks[0].account).to.be.equal("Income");
      expect(locks[0].__v).to.be.equal(2);
      expect(locks[0].updatedAt.getTime()).gt(beginDate.getTime());
      expect(locks[0].updatedAt.getTime()).lt(Date.now());
    });
  });
}

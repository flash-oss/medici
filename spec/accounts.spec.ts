import { Book } from "../src/Book";
import { assert } from "chai";

describe("accounts", function () {
  it("should allow more than 4 subaccounts of third level", async function () {
    const book = new Book("MyBook");
    await book
      .entry("depth test")
      .credit("X:Y:AUD", 1)
      .credit("X:Y:EUR", 1)
      .credit("X:Y:USD", 1)
      .credit("X:Y:INR", 1)
      .credit("X:Y:CHF", 1)
      .debit("CashAssets", 5)
      .commit();

    let result = await book.balance({ account: "X:Y" });
    assert.strictEqual(result.balance, 5);

    const accounts = await book.listAccounts();
    assert.ok(accounts.includes("X:Y:AUD"));
    assert.ok(accounts.includes("X:Y:EUR"));
    assert.ok(accounts.includes("X:Y:USD"));
    assert.ok(accounts.includes("X:Y:INR"));
    assert.ok(accounts.includes("X:Y:CHF"));
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

    assert.strictEqual(total, 2);
  });
});

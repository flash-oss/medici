import { Book } from "../src/Book";
import { assert } from "chai";

describe("approved/pending transactions", function () {
  let sharedPendingJournal = null;

  it("should not include pending transactions in balance", async () => {
    const book = new Book("MyBook");

    sharedPendingJournal = await book
      .entry("Test Entry")
      .debit("Foo", 500)
      .credit("Bar", 500)
      .setApproved(false)
      .commit();
    const data = await book.balance({
      account: "Foo",
    });
    assert.strictEqual(data.balance, 0);
  });

  it("should not include pending transactions in ledger", async () => {
    const book = new Book("MyBook");
    let response = await book.ledger({
      account: ["Foo"],
    });
    assert.strictEqual(response.results.length, 0);
  });

  it("should set all transactions to approved when approving the journal", async () => {
    const book = new Book("MyBook");
    sharedPendingJournal.approved = true;
    await sharedPendingJournal.save();
    const data = await book.balance({
      account: "Bar",
    });
    assert.strictEqual(data.balance, 500);
  });
});

import { Book } from "../src/Book";
import { assert } from "chai";
import { Document, Types } from "mongoose";
import { IJournal } from "../src/models/journals";

describe("approved/pending transactions", function () {
  let sharedPendingJournal:
    | (Document<any, any, any> &
        IJournal & {
          _original_journal?: Types.ObjectId;
        })
    | null = null;

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
    const response = await book.ledger({
      account: ["Foo"],
    });
    assert.strictEqual(response.results.length, 0);
  });

  it("should set all transactions to approved when approving the journal", async () => {
    const book = new Book("MyBook");
    sharedPendingJournal!.approved = true;
    await sharedPendingJournal!.save();
    const data = await book.balance({
      account: "Bar",
    });
    assert.strictEqual(data.balance, 500);
  });
});

const { Book } = require("../");

describe("approved/pending transactions", function() {
  let sharedPnedingJournal = null;

  it("should not include pending transactions in balance", async () => {
    const book = new Book("MyBook");

    sharedPnedingJournal = await book
      .entry("Test Entry")
      .debit("Foo", 500)
      .credit("Bar", 500)
      .setApproved(false)
      .commit();
    const data = await book.balance({
      account: "Foo"
    });
    data.balance.should.equal(0);
  });

  it("should not include pending transactions in ledger", async () => {
    const book = new Book("MyBook");
    let response = await book.ledger({
      account: ["Foo"]
    });
    response.results.length.should.equal(0);
  });

  it("should set all transactions to approved when approving the journal", async () => {
    const book = new Book("MyBook");
    sharedPnedingJournal.approved = true;
    await sharedPnedingJournal.save();
    const data = await book.balance({
      account: "Bar"
    });
    data.balance.should.equal(500);
  });
});

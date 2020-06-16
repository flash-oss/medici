const { Book } = require("../");

async function rejects(promise, errMessage) {
  let thrown = false;
  try {
    await promise;
  } catch (err) {
    thrown = true;
    err.message.should.equal(errMessage);
  }
  if (!thrown) throw new Error(`Should have thrown: ${errMessage}`);
}

describe("general", function() {
  let sharedJournal = null;

  it("should let you create a basic transaction", async function() {
    const book = new Book("MyBook");
    let journal = await book
      .entry("Test Entry")
      .debit("Assets:Receivable", 500, { clientId: "12345" })
      .credit("Income:Rent", 500)
      .commit();
    journal.memo.should.equal("Test Entry");
    journal._transactions.length.should.equal(2);
    sharedJournal = journal;
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    let journal1 = await book
      .entry("Test Entry 2", threeDaysAgo)
      .debit("Assets:Receivable", 700)
      .credit("Income:Rent", 700)
      .commit();
    journal1.book.should.equal("MyBook");
    journal1.memo.should.equal("Test Entry 2");
    journal1._transactions.length.should.equal(2);
  });

  it("should deal with JavaScript rounding weirdness", async function() {
    const book = new Book("MyBook");
    await book
      .entry("Rounding Test")
      .credit("A:B", 1005)
      .debit("A:B", 994.95)
      .debit("A:B", 10.05)
      .commit();
    let result1 = await book.balance({ account: "A:B" });
    const { balance } = result1;
    balance.should.equal(0);
  });

  it("should throw INVALID_JOURNAL if an entry total is !=0 and <0", async () => {
    const book = new Book("MyBook");
    const entry = book.entry("This is a test entry");
    entry.debit("Assets:Cash", 99.9, {});
    entry.credit("Income", 99.8, {});
    await rejects(entry.commit(), "INVALID_JOURNAL: can't commit non zero total");
  });

  it("should throw INVALID_JOURNAL if an entry total is !=0 and >0", async () => {
    const book = new Book("MyBook");
    const entry = book.entry("This is a test entry");
    entry.debit("Assets:Cash", 99.8, {});
    entry.credit("Income", 99.9, {});
    await rejects(entry.commit(), "INVALID_JOURNAL: can't commit non zero total");
  });

  it("should have updated the balance for assets and income and accurately give balance for subaccounts", async () => {
    const book = new Book("MyBook");

    const data = await book.balance({
      account: "Assets"
    });
    let bal = data.balance;
    let { notes } = data;
    notes.should.equal(2);
    bal.should.equal(-1200);

    const data1 = await book.balance({ account: "Assets:Receivable" });
    bal = data1.balance;
    ({ notes } = data1);
    bal.should.equal(-1200);
    notes.should.equal(2);

    const data2 = await book.balance({
      account: "Assets:Other"
    });
    bal = data2.balance;
    ({ notes } = data2);
    bal.should.equal(0);
    notes.should.equal(0);
  });

  it("should return full ledger", async () => {
    const book = new Book("MyBook");
    const res = await book.ledger({
      account: "Assets"
    });
    res.results.length.should.equal(2);
  });

  it("should allow you to void a journal entry", async () => {
    const book = new Book("MyBook");
    const data = await book.balance({
      account: "Assets",
      clientId: "12345"
    });
    data.balance.should.equal(-500);

    await book.void(sharedJournal._id, "Messed up");
    const data1 = await book.balance({
      account: "Assets"
    });
    data1.balance.should.equal(-700);

    const data2 = await book.balance({
      account: "Assets",
      clientId: "12345"
    });
    data2.balance.should.equal(0);
  });

  it("should list all accounts", async () => {
    const book = new Book("MyBook");
    const accounts = await book.listAccounts();
    accounts.indexOf("Assets").should.be.greaterThan(-1);
    accounts.indexOf("Assets:Receivable").should.be.greaterThan(-1);
    accounts.indexOf("Income").should.be.greaterThan(-1);
    accounts.indexOf("Income:Rent").should.be.greaterThan(-1);
  });

  it("should return ledger with array of accounts", async () => {
    const book = new Book("MyBook");
    const response = await book.ledger({
      account: ["Assets", "Income"]
    });
    response.results.length.should.equal(6);
    for (let res of response.results) {
      (res.account_path.indexOf("Assets") >= 0 || res.account_path.indexOf("Income") >= 0).should.equal(true);
    }
  });
});

const { Book } = require("../");

describe("accounts", function() {
  it("should allow more than 4 subaccounts of third level", async function() {
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
    result.balance.should.equal(5);
  });
});

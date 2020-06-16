const { Book } = require("../");

describe("accounts", function() {
  it("should deal with JavaScript rounding weirdness", async function() {
    const book = new Book("MyBook");
    await book
      .entry("depth test")
      .credit("X:Y:AUD", 1)
      .credit("X:Y:EUR", 1)
      .credit("X:Y:USD", 1)
      .credit("X:Y:INR", 1)
      .credit("X:Y:CHF", 1)
      .debit("Assets", 5)
      .commit();
    let result = await book.balance({ account: "X:Y" });
    result.balance.should.equal(5);
  });
});

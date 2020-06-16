const { Book } = require("../");

describe("pagination", () => {
  it("should give you a paginated ledger when requested", async () => {
    const book = new Book("MyBook");
    const response = await book.ledger({
      account: ["Assets", "Income"],
      perPage: 2,
      page: 3
    });
    response.results.length.should.equal(2);
    response.total.should.equal(6);
    response.results[0].memo.should.equal("Test Entry 2");
    response.results[1].memo.should.equal("Test Entry 2");
  });

  it("should give you the balance by page", async () => {
    const book = new Book("MyBook");
    const data = await book.balance({
      account: "Assets",
      perPage: 1,
      page: 1
    });
    data.balance.should.equal(-700);

    const data1 = await book.balance({
      account: "Assets",
      perPage: 1,
      page: 2
    });
    data1.balance.should.equal(-1200);

    const data2 = await book.balance({
      account: "Assets",
      perPage: 1,
      page: 3
    });
    data2.balance.should.equal(-700);
  });
});

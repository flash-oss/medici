import { Book } from "../src/Book";
import { assert } from "chai";

describe("pagination", () => {
  it("should give you a paginated ledger when requested", async () => {
    const book = new Book("MyBook");
    const response = await book.ledger({
      account: ["Assets", "Income"],
      perPage: 2,
      page: 3
    });
    assert.strictEqual(response.results.length, 2);
    assert.strictEqual(response.total, 6);
    assert.strictEqual(response.results[0].memo, "Test Entry 2");
    assert.strictEqual(response.results[1].memo, "Test Entry 2");
  });

  it("should give you the balance by page", async () => {
    const book = new Book("MyBook");
    const data = await book.balance({
      account: "Assets",
      perPage: 1,
      page: 1
    });
    assert.strictEqual(data.balance, -700);

    const data1 = await book.balance({
      account: "Assets",
      perPage: 1,
      page: 2
    });
    assert.strictEqual(data1.balance, -1200);

    const data2 = await book.balance({
      account: "Assets",
      perPage: 1,
      page: 3
    });
    assert.strictEqual(data2.balance, -700);
  });
});

/* eslint sonarjs/no-duplicate-string: off, @typescript-eslint/no-non-null-assertion: off */
import { expect } from "chai";
import { Types } from "mongoose";
import { parseBalanceQuery } from "../src/helper/parse/parseBalanceQuery";
import { parseFilterQuery } from "../src/helper/parse/parseFilterQuery";

describe("parseBalanceQuery", () => {
  it("should handle empty object and book name correctly", () => {
    const result = parseBalanceQuery({}, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(1);
    expect(result.book).to.be.equal("MyBook");
  });

  it("should put _journal string as string to meta", () => {
    const _journal = new Types.ObjectId().toString();
    const result = parseBalanceQuery({ _journal }, { name: "MyBook" });
    expect(result).to.deep.equal({
      book: "MyBook",
      meta: { _journal },
    });
  });

  it("should put _journal ObjectId as ObjectId to meta", () => {
    const _journal = new Types.ObjectId();
    const result = parseBalanceQuery({ _journal }, { name: "MyBook" });
    expect(result).to.deep.equal({
      book: "MyBook",
      meta: { _journal: new Types.ObjectId(_journal) },
    });
  });

  it("should handle start_date correctly", () => {
    const start_date = new Date(666);
    const result = parseBalanceQuery({ start_date }, { name: "MyBook" });
    expect(result).to.deep.equal({
      book: "MyBook",
      datetime: {
        $gte: new Date(666),
      },
    });
  });

  it("should handle end_date correctly", () => {
    const end_date = new Date(999);
    const result = parseBalanceQuery({ end_date }, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(2);
    expect(result.book).to.be.equal("MyBook");
    expect(result.datetime["$lte"]).to.be.instanceOf(Date);
    expect(result.datetime["$lte"].getTime()).to.be.equal(999);
  });

  it("should handle start_date and end_date correctly", () => {
    const start_date = new Date(666);
    const end_date = new Date(999);
    const result = parseBalanceQuery({ start_date, end_date }, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(2);
    expect(result.book).to.be.equal("MyBook");
    expect(result.datetime).to.have.property("$lte");
    expect(result.datetime).to.have.property("$gte");
    expect(result.datetime["$gte"]).to.be.instanceOf(Date);
    expect(result.datetime["$gte"].getTime()).to.be.equal(666);
    expect(result.datetime["$lte"]).to.be.instanceOf(Date);
    expect(result.datetime["$lte"].getTime()).to.be.equal(999);
  });

  it("should handle meta correctly", () => {
    const clientId = "619af485cd56547936847584";
    let bookmarked = true;
    const result1 = parseBalanceQuery({ clientId, bookmarked }, { name: "MyBook" });
    expect(result1).to.deep.equal({ book: "MyBook", meta: { clientId, bookmarked } });

    bookmarked = false;
    const _someOtherDatabaseId = "619af485cd56547936847584";
    const result2 = parseFilterQuery({ _someOtherDatabaseId, bookmarked }, { name: "MyBook" });
    expect(result2).to.deep.equal({ book: "MyBook", meta: { _someOtherDatabaseId, bookmarked } });
  });

  it("should handle account with one path part correctly", () => {
    const account = "Assets";
    const result = parseBalanceQuery({ account }, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(2);
    expect(result.book).to.be.equal("MyBook");
    expect(result["account_path.0"]).to.be.equal("Assets");
  });

  it("should handle account with two path parts correctly", () => {
    const account = "Assets:Gold";
    const result = parseBalanceQuery({ account }, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(3);
    expect(result.book).to.be.equal("MyBook");
    expect(result["account_path.0"]).to.be.equal("Assets");
    expect(result["account_path.1"]).to.be.equal("Gold");
  });

  it("should handle account with two path parts and maxAccountPath = 2 correctly", () => {
    const account = "Assets:Gold";
    const result = parseBalanceQuery({ account }, { name: "MyBook", maxAccountPath: 2 });
    expect(Object.keys(result)).to.have.lengthOf(2);
    expect(result.book).to.be.equal("MyBook");
    expect(result.accounts).to.be.equal("Assets:Gold");
  });

  it("should handle account with three path parts correctly", () => {
    const account = "Assets:Gold:Swiss";
    const result = parseBalanceQuery({ account }, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(2);
    expect(result.book).to.be.equal("MyBook");
    expect(result.accounts).to.be.equal("Assets:Gold:Swiss");
  });

  it("should handle account array with one path part correctly", () => {
    const account = ["Assets", "Expenses"];
    const result = parseBalanceQuery({ account }, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(2);
    expect(result.book).to.be.equal("MyBook");
    expect(result["$or"]).to.have.lengthOf(2);
    expect(Object.keys(result["$or"]![0])).to.have.lengthOf(1);
    expect(Object.keys(result["$or"]![1])).to.have.lengthOf(1);
    expect(result["$or"]![0]["account_path.0"]).to.be.equal("Assets");
    expect(result["$or"]![1]["account_path.0"]).to.be.equal("Expenses");
  });

  it("should handle account array with two path parts correctly", () => {
    const account = ["Assets:Gold", "Expenses:Gold"];
    const result = parseBalanceQuery({ account }, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(2);
    expect(result.book).to.be.equal("MyBook");
    expect(result["$or"]).to.have.lengthOf(2);
    expect(Object.keys(result["$or"]![0])).to.have.lengthOf(2);
    expect(Object.keys(result["$or"]![1])).to.have.lengthOf(2);
    expect(result["$or"]![0]["account_path.0"]).to.be.equal("Assets");
    expect(result["$or"]![0]["account_path.1"]).to.be.equal("Gold");
    expect(result["$or"]![1]["account_path.0"]).to.be.equal("Expenses");
    expect(result["$or"]![1]["account_path.1"]).to.be.equal("Gold");
  });

  it("should handle account array with three path parts correctly", () => {
    const account = ["Assets:Gold:Swiss", "Expenses:Gold:Swiss"];
    const result = parseBalanceQuery({ account }, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(2);
    expect(result.book).to.be.equal("MyBook");
    expect(result["$or"]).to.have.lengthOf(2);
    expect(Object.keys(result["$or"]![0])).to.have.lengthOf(1);
    expect(Object.keys(result["$or"]![1])).to.have.lengthOf(1);
    expect(result["$or"]![0]["accounts"]).to.be.equal("Assets:Gold:Swiss");
    expect(result["$or"]![1]["accounts"]).to.be.equal("Expenses:Gold:Swiss");
  });

  it("should handle account array with one item and two path parts correctly", () => {
    const account = ["Assets:Gold"];
    const result = parseBalanceQuery({ account }, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(3);
    expect(result.book).to.be.equal("MyBook");
    expect(result["account_path.0"]).to.be.equal("Assets");
    expect(result["account_path.1"]).to.be.equal("Gold");
  });

  it("should handle account array with one item and three path parts correctly", () => {
    const account = ["Assets:Gold:Swiss"];
    const result = parseBalanceQuery({ account }, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(2);
    expect(result.book).to.be.equal("MyBook");
    expect(result["accounts"]).to.be.equal("Assets:Gold:Swiss");
  });
});

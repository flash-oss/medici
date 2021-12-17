/* eslint sonarjs/no-duplicate-string: off */
import { expect } from "chai";
import { Types } from "mongoose";
import { parseQuery } from "../src/helper/parseQuery";

describe("parseQuery", () => {
  it("should handle empty object and book name correctly", () => {
    const result = parseQuery({}, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(2);
    expect(result.book).to.be.equal("MyBook");
    expect(result.approved).to.be.equal(true);
  });

  it("should handle approved false correctly", () => {
    const result = parseQuery({ approved: false }, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(2);
    expect(result.book).to.be.equal("MyBook");
    expect(result.approved).to.be.equal(false);
  });

  it("should handle _journal string correctly", () => {
    const _journal = new Types.ObjectId().toString();
    const result = parseQuery({ _journal }, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(3);
    expect(result.book).to.be.equal("MyBook");
    expect(result.approved).to.be.equal(true);
    expect(result._journal).to.be.instanceOf(Types.ObjectId);
    expect(result._journal.toString()).to.be.equal(_journal);
  });

  it("should handle _journal ObjectId correctly", () => {
    const _journal = new Types.ObjectId();
    const result = parseQuery({ _journal }, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(3);
    expect(result.book).to.be.equal("MyBook");
    expect(result.approved).to.be.equal(true);
    expect(result._journal).to.be.instanceOf(Types.ObjectId);
    expect(result._journal.toString()).to.be.equal(_journal.toString());
  });

  it("should handle start_date correctly", () => {
    const start_date = new Date(666);
    const result = parseQuery({ start_date }, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(3);
    expect(result.book).to.be.equal("MyBook");
    expect(result.approved).to.be.equal(true);
    expect(result.datetime).to.have.property("$gte");
    expect(result.datetime["$gte"]).to.be.instanceOf(Date);
    expect(result.datetime["$gte"].getTime()).to.be.equal(666);
    expect(result.datetime).to.not.have.property("$lte");
  });

  it("should handle end_date correctly", () => {
    const end_date = new Date(999);
    const result = parseQuery({ end_date }, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(3);
    expect(result.book).to.be.equal("MyBook");
    expect(result.approved).to.be.equal(true);
    expect(result.datetime["$lte"]).to.be.instanceOf(Date);
    expect(result.datetime["$lte"].getTime()).to.be.equal(999);
  });

  it("should handle start_date and end_date correctly", () => {
    const start_date = new Date(666);
    const end_date = new Date(999);
    const result = parseQuery({ start_date, end_date }, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(3);
    expect(result.book).to.be.equal("MyBook");
    expect(result.approved).to.be.equal(true);
    expect(result.datetime).to.have.property("$lte");
    expect(result.datetime).to.have.property("$gte");
    expect(result.datetime["$gte"]).to.be.instanceOf(Date);
    expect(result.datetime["$gte"].getTime()).to.be.equal(666);
    expect(result.datetime["$lte"]).to.be.instanceOf(Date);
    expect(result.datetime["$lte"].getTime()).to.be.equal(999);
  });

  it("should handle meta correctly", () => {
    const clientId = "Jack Black";
    const result = parseQuery({ clientId }, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(3);
    expect(result.book).to.be.equal("MyBook");
    expect(result.approved).to.be.equal(true);
    expect(result).to.have.property("meta.clientId");
    expect(result["meta.clientId"]).to.be.equal("Jack Black");
  });

  it("should handle account with one path part correctly", () => {
    const account = "Assets";
    const result = parseQuery({ account }, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(3);
    expect(result.book).to.be.equal("MyBook");
    expect(result.approved).to.be.equal(true);
    expect(result["account_path.0"]).to.be.equal("Assets");
  });

  it("should handle account with two path parts correctly", () => {
    const account = "Assets:Gold";
    const result = parseQuery({ account }, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(4);
    expect(result.book).to.be.equal("MyBook");
    expect(result.approved).to.be.equal(true);
    expect(result["account_path.0"]).to.be.equal("Assets");
    expect(result["account_path.1"]).to.be.equal("Gold");
  });

  it("should handle account with three path parts correctly", () => {
    const account = "Assets:Gold:Swiss";
    const result = parseQuery({ account }, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(5);
    expect(result.book).to.be.equal("MyBook");
    expect(result.approved).to.be.equal(true);
    expect(result["account_path.0"]).to.be.equal("Assets");
    expect(result["account_path.1"]).to.be.equal("Gold");
    expect(result["account_path.2"]).to.be.equal("Swiss");
  });

  it("should handle account array with one path part correctly", () => {
    const account = ["Assets", "Expenses"];
    const result = parseQuery({ account }, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(3);
    expect(result.book).to.be.equal("MyBook");
    expect(result.approved).to.be.equal(true);
    expect(result["$or"]).to.have.lengthOf(2);
    expect(result["$or"][0]["account_path.0"]).to.be.equal("Assets");
    expect(result["$or"][1]["account_path.0"]).to.be.equal("Expenses");
  });

  it("should handle account array with two path parts correctly", () => {
    const account = ["Assets:Gold", "Expenses:Gold"];
    const result = parseQuery({ account }, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(3);
    expect(result.book).to.be.equal("MyBook");
    expect(result.approved).to.be.equal(true);
    expect(result["$or"]).to.have.lengthOf(2);
    expect(result["$or"][0]["account_path.0"]).to.be.equal("Assets");
    expect(result["$or"][0]["account_path.1"]).to.be.equal("Gold");
    expect(result["$or"][1]["account_path.0"]).to.be.equal("Expenses");
    expect(result["$or"][1]["account_path.1"]).to.be.equal("Gold");
  });

  it("should handle account array with two path parts correctly", () => {
    const account = ["Assets:Gold:Swiss", "Expenses:Gold:Swiss"];
    const result = parseQuery({ account }, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(3);
    expect(result.book).to.be.equal("MyBook");
    expect(result.approved).to.be.equal(true);
    expect(result["$or"]).to.have.lengthOf(2);
    expect(result["$or"][0]["account_path.0"]).to.be.equal("Assets");
    expect(result["$or"][0]["account_path.1"]).to.be.equal("Gold");
    expect(result["$or"][0]["account_path.2"]).to.be.equal("Swiss");
  });

  it("should handle account array with one item and three path parts correctly", () => {
    const account = ["Assets:Gold:Swiss"];
    const result = parseQuery({ account }, { name: "MyBook" });
    expect(Object.keys(result)).to.have.lengthOf(5);
    expect(result.book).to.be.equal("MyBook");
    expect(result.approved).to.be.equal(true);
    expect(result["account_path.0"]).to.be.equal("Assets");
    expect(result["account_path.1"]).to.be.equal("Gold");
    expect(result["account_path.2"]).to.be.equal("Swiss");
  });
});

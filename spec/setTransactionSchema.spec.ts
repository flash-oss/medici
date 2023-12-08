/* eslint sonarjs/no-duplicate-string: off */
import { expect } from "chai";
import { Types } from "mongoose";
import { Book, syncIndexes } from "../src";
import { setTransactionSchema, transactionModel, transactionSchema } from "../src/models/transaction";
import { getTransactionSchemaTest, ITransactionTest } from "./helper/transactionSchema";

describe("setTransactionSchema", () => {
  it("should return full ledger with _journal2", async function () {
    this.timeout(10000);
    await syncIndexes({ background: false });

    try {
      const transactionSchemaTest = getTransactionSchemaTest();

      setTransactionSchema(transactionSchemaTest, undefined, {
        defaultIndexes: false,
      });

      const diffIndexesBefore = await transactionModel.diffIndexes();
      expect(diffIndexesBefore.toDrop).to.have.lengthOf(3);
      expect(diffIndexesBefore.toCreate[0]).to.be.deep.equal({
        voided: 1,
        void_reason: 1,
      });

      const book = new Book<ITransactionTest>("MyBook-TransactionSchema");

      const journal = await book
        .entry("Test")
        .credit("Assets:Receivable", 1)
        .credit("Assets:Receivable", 2)
        .debit("Income:Rent", 1)
        .debit("Income:Rent", 2)
        .commit();

      await book
        .entry("Test fp")
        .credit("Cars", 1, { _journal2: journal._id })
        .debit("Cars", 1, { _journal2: journal._id })
        .commit();
      const res = await book.ledger({ account: "Cars" });
      expect(res.results).to.have.lengthOf(2);
      expect(res.results[0]._journal2._id).to.be.instanceof(Types.ObjectId);
      expect(res.results[1]._journal2._id).to.be.instanceof(Types.ObjectId);
      expect(res.results[0]._journal2._id.toString()).to.be.equal(journal._id.toString());
      expect(res.results[1]._journal2._id.toString()).to.be.equal(journal._id.toString());
    } finally {
      setTransactionSchema(transactionSchema);
      await syncIndexes({ background: false });
    }
  });
});

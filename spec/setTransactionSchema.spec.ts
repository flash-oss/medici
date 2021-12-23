/* eslint sonarjs/no-duplicate-string: off */
import { expect } from "chai";
import { Schema, Types } from "mongoose";
import { Book } from "../src/Book";
import { IAnyObject } from "../src/IAnyObject";
import { IJournal } from "../src/models/journal";
import {
  setTransactionSchema,
  transactionModel,
  transactionSchema,
} from "../src/models/transaction";
import { syncIndexes } from "../src/helper/syncIndexes";

export interface ITransactionNew {
  _id: Types.ObjectId;
  credit: number;
  debit: number;
  meta: IAnyObject;
  datetime: Date;
  account_path: string[];
  accounts: string;
  book: string;
  memo: string;
  _journal: Types.ObjectId | IJournal;
  _journal2: Types.ObjectId | IJournal;
  timestamp: Date;
  voided: boolean;
  void_reason?: string;
  approved: boolean;
  _original_journal?: Types.ObjectId;
}

describe("setTransactionSchema", () => {
  it("should return full ledger with populated _journal2", async function () {
    this.timeout(10000);
    const newTransactionSchema = new Schema<ITransactionNew>(
      {
        credit: Number,
        debit: Number,
        meta: Schema.Types.Mixed,
        datetime: Date,
        account_path: [String],
        accounts: String,
        book: String,
        memo: String,
        _journal: {
          type: Schema.Types.ObjectId,
          ref: "Medici_Journal",
        },
        _journal2: {
          type: Schema.Types.ObjectId,
          ref: "Medici_Journal",
        },
        timestamp: Date,
        voided: {
          type: Boolean,
          default: false,
        },
        void_reason: String,
        // The journal that this is voiding, if any
        _original_journal: Schema.Types.ObjectId,
        approved: {
          type: Boolean,
          default: true,
        },
      },
      { id: false, versionKey: false, timestamps: false }
    );

    newTransactionSchema.index({
      voided: 1,
      void_reason: 1,
    });

    setTransactionSchema(newTransactionSchema, undefined, {
      defaultIndexes: false,
    });

    const diffIndexesBefore = await transactionModel.diffIndexes();
    expect(diffIndexesBefore.toDrop).to.have.lengthOf(6);
    expect(diffIndexesBefore.toCreate[0]).to.be.eql({
      voided: 1,
      void_reason: 1,
    });

    const book = new Book<ITransactionNew>("MyBook-TransactionSchema");

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
    const res = await book.ledger(
      {
        account: "Cars",
      },
      ["_journal2"]
    );
    expect(res.results).to.have.lengthOf(2);
    expect(res.results[0]._journal2._id).to.be.instanceof(Types.ObjectId);
    expect(res.results[1]._journal2._id).to.be.instanceof(Types.ObjectId);
    expect(res.results[0]._journal2._id.toString()).to.be.equal(
      journal._id.toString()
    );
    expect(res.results[1]._journal2._id.toString()).to.be.equal(
      journal._id.toString()
    );

    setTransactionSchema(transactionSchema);
    await syncIndexes({ background: false });
  });
});

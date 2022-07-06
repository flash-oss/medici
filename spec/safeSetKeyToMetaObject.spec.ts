/* eslint sonarjs/no-duplicate-string: off */
import { expect } from "chai";
import { Schema, Types } from "mongoose";
import { IAnyObject } from "../src/IAnyObject";
import { setTransactionSchema, transactionSchema } from "../src/models/transaction";
import { safeSetKeyToMetaObject } from "../src/helper/safeSetKeyToMetaObject";

export interface ITransactionNew {
  _id?: Types.ObjectId;
  credit: number;
  debit: number;
  meta?: IAnyObject;
  datetime: Date;
  account_path: string[];
  accounts: string;
  book: string;
  memo: string;
  _journal: Types.ObjectId;
  timestamp: Date;
  voided?: boolean;
  void_reason?: string;
  _original_journal?: Types.ObjectId;

  customField: string;
}

describe("safeSetKeyToMetaObject", () => {
  before(function () {
    const transactionSchemaNew = new Schema<ITransactionNew>(
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
        timestamp: Date,
        voided: Boolean,
        void_reason: String,
        // The journal that this is voiding, if any
        _original_journal: {
          type: Schema.Types.ObjectId,
          ref: "Medici_Journal",
        },

        customField: String,
      },
      { id: false, versionKey: false, timestamps: false }
    );

    setTransactionSchema(transactionSchemaNew, undefined, { defaultIndexes: false });
  });

  after(function () {
    setTransactionSchema(transactionSchema);
  });

  it("should set a custom schema attribute", function () {
    const newMeta: IAnyObject = {};
    safeSetKeyToMetaObject("customField", "value", newMeta);
    expect(Object.keys(newMeta)).to.have.lengthOf(1);
    expect(newMeta).to.be.eql({ customField: "value" });
  });

  it("should set a meta attribute", function () {
    const newMeta: IAnyObject = {};
    safeSetKeyToMetaObject("anotherField", "value", newMeta);
    expect(Object.keys(newMeta)).to.have.lengthOf(1);
    expect(newMeta).to.be.eql({ anotherField: "value" });
  });

  it("should set custom and meta attributes", function () {
    const newMeta: IAnyObject = {};
    safeSetKeyToMetaObject("customField", "value", newMeta);
    safeSetKeyToMetaObject("anotherField", "value", newMeta);
    expect(Object.keys(newMeta)).to.have.lengthOf(2);
    expect(newMeta).to.be.eql({ customField: "value", anotherField: "value" });
  });

  it("should not set prototype attributes", function () {
    const newMeta: IAnyObject = {};
    safeSetKeyToMetaObject("__proto__", "value", newMeta);
    safeSetKeyToMetaObject("__defineGetter__", "value", newMeta);
    safeSetKeyToMetaObject("__lookupGetter__", "value", newMeta);
    safeSetKeyToMetaObject("__defineSetter__", "value", newMeta);
    safeSetKeyToMetaObject("__lookupSetter__", "value", newMeta);
    safeSetKeyToMetaObject("constructor", "value", newMeta);
    safeSetKeyToMetaObject("hasOwnProperty", "value", newMeta);
    safeSetKeyToMetaObject("isPrototypeOf", "value", newMeta);
    safeSetKeyToMetaObject("propertyIsEnumerable", "value", newMeta);
    safeSetKeyToMetaObject("toString", "value", newMeta);
    safeSetKeyToMetaObject("toLocaleString", "value", newMeta);
    safeSetKeyToMetaObject("valueOf", "value", newMeta);
    expect(Object.keys(newMeta)).to.have.lengthOf(0);
  });

  it("should not set original schema attributes", function () {
    const newMeta: IAnyObject = {};
    Object.keys(transactionSchema.paths).forEach((key) => {
      safeSetKeyToMetaObject(key, "value", newMeta);
    });
    expect(Object.keys(newMeta)).to.have.lengthOf(0);
  });
});

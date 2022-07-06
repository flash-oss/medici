import { Schema, Types } from "mongoose";
import { IAnyObject } from "../../src/IAnyObject";

export interface ITransactionTest {
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

  // custom attributes
  _journal2: Types.ObjectId;
  clientId?: string;
}

export function getTransactionSchemaTest() {
  const transactionSchemaTest = new Schema<ITransactionTest>(
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

      // custom attributes
      _journal2: {
        type: Schema.Types.ObjectId,
        ref: "Medici_Journal",
      },
      clientId: String,
    },
    { id: false, versionKey: false, timestamps: false }
  );

  transactionSchemaTest.index({
    voided: 1,
    void_reason: 1,
  });

  return transactionSchemaTest;
}

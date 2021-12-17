import { connection, Schema, model, Model, Types } from "mongoose";
import type { IAnyObject } from "../IAnyObject";
import type { IJournal } from "./journals";

export interface ITransaction {
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
  timestamp: Date;
  voided: boolean;
  void_reason?: string;
  approved: boolean;
  _original_journal?: Types.ObjectId | IJournal;
}

export const transactionSchema = new Schema<ITransaction>(
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
    voided: {
      type: Boolean,
      default: false,
    },
    void_reason: String,
    // The journal that this is voiding, if any
    _original_journal: {
      type: Schema.Types.ObjectId,
      ref: "Medici_Journal",
    },
    approved: {
      type: Boolean,
      default: true,
    },
  },
  { id: false, versionKey: false, timestamps: false }
);

export let transactionModel: Model<ITransaction>;

let transactionSchemaKeys: Set<string> = new Set(
  Object.keys(transactionSchema.paths)
);

export function isValidTransactionKey<T extends ITransaction = ITransaction>(
  value: unknown
): value is keyof T {
  return typeof value === "string" && transactionSchemaKeys.has(value);
}

export function setTransactionSchema(schema: Schema, collection?: string) {
  delete connection.models["Medici_Transaction"];

  schema.index({ _journal: 1 });
  schema.index({
    accounts: 1,
    book: 1,
    approved: 1,
    datetime: -1,
    timestamp: -1,
  });
  schema.index({ "account_path.0": 1, book: 1, approved: 1 });
  schema.index({
    "account_path.0": 1,
    "account_path.1": 1,
    book: 1,
    approved: 1,
  });
  schema.index({
    "account_path.0": 1,
    "account_path.1": 1,
    "account_path.2": 1,
    book: 1,
    approved: 1,
  });

  transactionModel = model("Medici_Transaction", schema, collection);

  transactionSchemaKeys = new Set(Object.keys(schema.paths));
}

typeof connection.models["Medici_Transaction"] === "undefined" &&
  setTransactionSchema(transactionSchema);

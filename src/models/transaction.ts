import { connection, Schema, model, Model, Types } from "mongoose";
import { extractObjectIdKeysFromSchema } from "../helper/extractObjectIdKeysFromSchema";
import type { IAnyObject } from "../IAnyObject";

export interface ITransaction {
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
    voided: Boolean,
    void_reason: String,
    // The journal that this is voiding, if any
    _original_journal: {
      type: Schema.Types.ObjectId,
      ref: "Medici_Journal",
    },
  },
  { id: false, versionKey: false, timestamps: false }
);

export let transactionModel: Model<ITransaction>;

export const defaultTransactionSchemaKeys: Set<string> = new Set(Object.keys(transactionSchema.paths));

let transactionSchemaKeys: Set<string> = defaultTransactionSchemaKeys;

export function isValidTransactionKey<T extends ITransaction = ITransaction>(
  value: unknown,
  schemaKeys: Set<string> = transactionSchemaKeys
): value is keyof T {
  return typeof value === "string" && schemaKeys.has(value);
}

let transactionSchemaObjectIdKeys: Set<string> = extractObjectIdKeysFromSchema(transactionSchema);

export function isTransactionObjectIdKey(value: unknown): boolean {
  return typeof value === "string" && transactionSchemaObjectIdKeys.has(value);
}

export function setTransactionSchema(schema: Schema, collection?: string, options = {} as { defaultIndexes: boolean }) {
  const { defaultIndexes = true } = options;

  if (connection.models["Medici_Transaction"]) {
    connection.deleteModel("Medici_Transaction");
  }

  if (defaultIndexes) {
    schema.index({ _journal: 1 });
    schema.index({
      accounts: 1,
      book: 1,
      datetime: -1,
      timestamp: -1,
    });
    schema.index({
      datetime: -1,
      timestamp: -1,
    });
    schema.index({ "account_path.0": 1, book: 1 });
    schema.index({
      "account_path.0": 1,
      "account_path.1": 1,
      book: 1,
    });
    schema.index({
      "account_path.0": 1,
      "account_path.1": 1,
      "account_path.2": 1,
      book: 1,
    });
  }

  transactionModel = model("Medici_Transaction", schema, collection) as unknown as Model<ITransaction>;

  transactionSchemaKeys = new Set(Object.keys(schema.paths));
  transactionSchemaObjectIdKeys = extractObjectIdKeysFromSchema(schema);
}

!connection.models["Medici_Transaction"] && setTransactionSchema(transactionSchema);

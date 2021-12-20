import {
  connection,
  Schema,
  model,
  Model,
  Types,
  PreSaveMiddlewareFunction,
  Document,
} from "mongoose";
import { extractObjectIdKeysFromSchema } from "../helper/extractObjectIdKeysFromSchema";
import type { IAnyObject } from "../IAnyObject";
import type { IJournal } from "./journals";
import { lockModel } from "./lock";

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

const preSave: PreSaveMiddlewareFunction<ITransaction & Document> =
  async function (next) {
    if (
      !this.isModified("approved") ||
      // @ts-ignore
      (this.$isNew === true && this.approved === false) ||
      !this.$session()
    ) {
      return next();
    }

    if (
      this.$locals.lock &&
      (this.$locals.lock as string[]).indexOf(this.accounts) === -1
    ) {
      return next();
    }

    const session = this.$session();

    const book = this.book;
    const account = this.accounts;

    await lockModel.collection.updateOne(
      { account, book },
      { $inc: { __v: 1 } },
      { upsert: true, session }
    );
    return next();
  };

export function isValidTransactionKey<T extends ITransaction = ITransaction>(
  value: unknown
): value is keyof T {
  return typeof value === "string" && transactionSchemaKeys.has(value);
}

let transactionSchemaObjectIdKeys: Set<string> =
  extractObjectIdKeysFromSchema(transactionSchema);

export function isTransactionObjectIdKey(value: unknown): boolean {
  return typeof value === "string" && transactionSchemaObjectIdKeys.has(value);
}

export function setTransactionSchema(
  schema: Schema,
  collection?: string,
  options = {} as { defaultIndexes: boolean }
) {
  const { defaultIndexes = true } = options;

  delete connection.models["Medici_Transaction"];

  if (defaultIndexes) {
    schema.index({ _journal: 1 });
    schema.index({
      accounts: 1,
      book: 1,
      approved: 1,
      datetime: -1,
      timestamp: -1,
    });
    schema.index({
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
  }

  schema.pre("save", preSave);

  transactionModel = model("Medici_Transaction", schema, collection);

  transactionSchemaKeys = new Set(Object.keys(schema.paths));
  transactionSchemaObjectIdKeys = extractObjectIdKeysFromSchema(schema);
}

typeof connection.models["Medici_Transaction"] === "undefined" &&
  setTransactionSchema(transactionSchema);

import { Schema, model, Model, Types } from "mongoose";

export interface ITransaction {
  _id?: Types.ObjectId;
  credit: number;
  debit: number;
  meta: { [key: string]: any };
  datetime: Date;
  account_path: string[];
  accounts: string;
  book: string;
  memo: string;
  _journal: Types.ObjectId;
  timestamp: Date;
  voided: boolean;
  void_reason?: string;
  approved: boolean;
  _original_journal?: Types.ObjectId;
}

const transactionSchema = new Schema<ITransaction>(
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
    timestamp: {
      type: Date,
      default: () => new Date(),
    },
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
transactionSchema.index({ _journal: 1 });
transactionSchema.index({
  accounts: 1,
  book: 1,
  approved: 1,
  datetime: -1,
  timestamp: -1,
});
transactionSchema.index({ "account_path.0": 1, book: 1, approved: 1 });
transactionSchema.index({
  "account_path.0": 1,
  "account_path.1": 1,
  book: 1,
  approved: 1,
});
transactionSchema.index({
  "account_path.0": 1,
  "account_path.1": 1,
  "account_path.2": 1,
  book: 1,
  approved: 1,
});

export let transactionModel: Model<ITransaction, {}, {}, {}>;

try {
  transactionModel = model("Medici_Transaction");
} catch {
  transactionModel = model("Medici_Transaction", transactionSchema);
}

const transactionSchemaKeys = Object.keys(transactionModel.schema.paths);

export function isValidTransactionKey(
  value: unknown
): value is keyof ITransaction {
  return (
    typeof value === "string" && transactionSchemaKeys.indexOf(value) !== -1
  );
}

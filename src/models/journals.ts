import { Schema, Document, Model, model, Types } from "mongoose";
import {
  isValidTransactionKey,
  ITransaction,
  transactionModel,
} from "./transactions";
import { Book } from "../Book";
import type { IOptions } from "../IOptions";

export interface IJournal {
  _id: Types.ObjectId;
  datetime: Date;
  memo: string;
  _transactions: Types.ObjectId[] | ITransaction[];
  book: string;
  voided: boolean;
  void_reason: string;
  approved: boolean;
}

const journalSchema = new Schema<IJournal>(
  {
    datetime: Date,
    memo: {
      type: String,
      default: "",
    },
    _transactions: [
      {
        type: Schema.Types.ObjectId,
        ref: "Medici_Transaction",
      },
    ],
    book: String,
    voided: {
      type: Boolean,
      default: false,
    },
    void_reason: String,
    approved: {
      type: Boolean,
      default: true,
    },
  },
  { id: false, versionKey: false, timestamps: false }
);

journalSchema.methods.void = async function (
  book: Book,
  reason: string,
  options = {} as IOptions
) {
  if (this.voided === true) {
    throw new Error("Journal already voided");
  }

  // Set this to void with reason and also set all associated transactions
  this.voided = true;
  this.void_reason = reason || "";

  const voidTransaction = (trans_id: string) => {
    return transactionModel.findByIdAndUpdate(
      trans_id,
      {
        voided: true,
        void_reason: this.void_reason,
      },
      { ...options, new: true }
    );
  };

  const transactions = (await Promise.all(
    this._transactions.map(voidTransaction)
  )) as (Document & ITransaction)[];
  let newMemo;
  if (this.void_reason) {
    newMemo = this.void_reason;
  } else {
    // It's either VOID, UNVOID, or REVOID
    if (this.memo.substr(0, 6) === "[VOID]") {
      newMemo = this.memo.replace("[VOID]", "[UNVOID]");
    } else if (this.memo.substr(0, 8) === "[UNVOID]") {
      newMemo = this.memo.replace("[UNVOID]", "[REVOID]");
    } else if (this.memo.substr(0, 8) === "[REVOID]") {
      newMemo = this.memo.replace("[REVOID]", "[UNVOID]");
    } else {
      newMemo = `[VOID] ${this.memo}`;
    }
  }
  const entry = book.entry(newMemo, null, this._id);

  function processMetaField(
    key: string,
    val: any,
    meta: { [key: string]: any }
  ) {
    return isValidTransactionKey(key) ? undefined : (meta[key] = val);
  }

  for (const trans of transactions) {
    const transObject = trans.toObject() as unknown as ITransaction;
    const meta = {};

    Object.keys(transObject).forEach((key) => {
      const val = transObject[key as keyof ITransaction];
      if (key === "meta") {
        Object.keys(transObject["meta"]).forEach((keyMeta) => {
          processMetaField(keyMeta, transObject["meta"][keyMeta], meta);
        });
      } else {
        processMetaField(key, val, meta);
      }
    });

    if (transObject.credit) {
      entry.debit(transObject.account_path, transObject.credit, meta);
    }
    if (transObject.debit) {
      entry.credit(transObject.account_path, transObject.debit, meta);
    }
  }
  return entry.commit(options);
};

journalSchema.pre("save", async function (next) {
  if (!(this.isModified("approved") && this.approved === true)) {
    return next();
  }

  const session = this.$session();

  const transactions = (await transactionModel.find(
    { _journal: this._id, approved: false },
    undefined,
    { session }
  )) as (Document & ITransaction)[];
  await Promise.all(
    transactions.map((tx) => {
      tx.approved = true;
      return tx.save({ session });
    })
  );
  return next();
});

export type TJournalModel = Model<IJournal> & {
  void: (book: string, reason: string) => Promise<any>;
};

export let journalModel: TJournalModel;

try {
  journalModel = model("Medici_Journal") as TJournalModel;
} catch {
  journalModel = model("Medici_Journal", journalSchema) as TJournalModel;
}

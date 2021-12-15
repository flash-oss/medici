import { Schema, Document, Model, model, Types } from "mongoose";
import {
  isValidTransactionKey,
  ITransaction,
  transactionModel,
} from "./transactions";
import { Book } from "../Book";
import type { IOptions } from "../IOptions";
import { handleVoidMemo } from "../helper/handleVoidMemo";

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

  const voidTransaction = (trans_id: Types.ObjectId) => {
    return transactionModel
      .findByIdAndUpdate(
        trans_id,
        {
          voided: true,
          void_reason: this.void_reason,
        },
        { ...options }
      )
      .lean(true);
  };

  const transactions = (await Promise.all(
    (this._transactions as Types.ObjectId[]).map(voidTransaction)
  )) as ITransaction[];

  const entry = book.entry(handleVoidMemo(reason, this.memo), null, this._id);

  function processMetaField(
    key: string,
    val: any,
    meta: { [key: string]: any }
  ) {
    return isValidTransactionKey(key) ? undefined : (meta[key] = val);
  }

  for (const trans of transactions) {
    const meta = {};

    Object.keys(trans).forEach((key) => {
      const val = trans[key as keyof ITransaction];
      if (key === "meta") {
        Object.keys(trans["meta"]).forEach((keyMeta) => {
          processMetaField(keyMeta, trans["meta"][keyMeta], meta);
        });
      } else {
        processMetaField(key, val, meta);
      }
    });

    if (trans.credit) {
      entry.debit(trans.account_path, trans.credit, meta);
    }
    if (trans.debit) {
      entry.credit(trans.account_path, trans.debit, meta);
    }
  }
  await this.save(options);
  return entry.commit(options);
} as (
  this: TJournalDocument,
  book: Book,
  reason?: undefined | string,
  options?: IOptions
) => Promise<any>;

journalSchema.pre("save", async function (next) {
  if (!(this.isModified("approved") && this.approved === true)) {
    return next();
  }

  const session = this.$session();

  const transactions = (await transactionModel
    .find({ _journal: this._id, approved: false }, undefined, { session })
    .exec()) as (Document & ITransaction)[];

  await Promise.all(
    transactions.map((tx) => {
      tx.approved = true;
      return tx.save({ session });
    })
  );

  return next();
});

export type TJournalDocument = Document &
  IJournal & {
    void: (
      book: Book,
      reason?: undefined | string,
      options?: IOptions
    ) => Promise<any>;
  };

export let journalModel: Model<IJournal>;

try {
  journalModel = model("Medici_Journal");
} catch {
  journalModel = model("Medici_Journal", journalSchema);
}

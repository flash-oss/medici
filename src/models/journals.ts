import {
  connection,
  Schema,
  Document,
  Model,
  model,
  Types,
  PreSaveMiddlewareFunction,
} from "mongoose";
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

function processMetaField(key: string, val: any, meta: { [key: string]: any }) {
  return isValidTransactionKey(key) ? undefined : (meta[key] = val);
}

const voidJournal = async function (
  book: Book,
  reason: string,
  options: IOptions
) {
  if (this.voided === true) {
    throw new Error("Journal already voided");
  }

  reason = handleVoidMemo(reason, this.memo);

  // Set this to void with reason and also set all associated transactions
  this.voided = true;
  this.void_reason = reason;

  const transactions = await transactionModel.find(
    {
      _journal: this._id,
    },
    undefined,
    options
  );

  for (let i = 0, il = transactions.length; i < il; i++) {
    transactions[i].voided = true;
    transactions[i].void_reason = this.void_reason;
  }

  for (let i = 0, il = transactions.length; i < il; i++) {
    await new transactionModel(transactions[i]).save(options);
  }

  const entry = book.entry(reason, null, this._id);

  for (const trans of transactions) {
    const meta = {};
    Object.keys(trans.toObject()).forEach((key) => {
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

const preSave: PreSaveMiddlewareFunction<IJournal & Document> = async function (
  this,
  next
) {
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
};

export type TJournalDocument<T extends IJournal = IJournal> = Document &
  T & {
    void: (
      book: Book,
      reason?: undefined | string,
      options?: IOptions
    ) => Promise<any>;
  };

type TJournalModel<T extends IJournal = IJournal> = Model<
  T,
  any,
  {
    void: (
      book: Book,
      reason?: undefined | string,
      options?: IOptions
    ) => Promise<any>;
  }
>;

export let journalModel: TJournalModel;

export function setJournalSchema(schema: Schema, collection?: string) {
  delete connection.models["Medici_Journal"];

  schema.methods.void = voidJournal;
  journalSchema.pre("save", preSave);

  journalModel = model("Medici_Journal", schema, collection) as TJournalModel;
}

typeof connection.models["Medici_Journal"] === "undefined" &&
  setJournalSchema(journalSchema);

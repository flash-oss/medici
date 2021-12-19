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
import type { Book } from "../Book";
import { handleVoidMemo } from "../helper/handleVoidMemo";
import type { IAnyObject } from "../IAnyObject";
import type { IOptions } from "../IOptions";
import { JournalAlreadyVoidedError } from "../errors/JournalAlreadyVoidedError";

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

function processMetaField(key: string, val: unknown, meta: IAnyObject): void {
  isValidTransactionKey(key) ? undefined : (meta[key] = val);
}

const voidJournal = async function (
  book: Book,
  reason: undefined | null | string,
  options: IOptions
) {
  if (this.voided === true) {
    throw new JournalAlreadyVoidedError();
  }

  reason = handleVoidMemo(reason, this.memo);

  // Set this to void with reason and also set all associated transactions
  this.voided = true;
  this.void_reason = reason;

  await this.save(options);

  const transactions = await transactionModel
    .find(
      {
        _journal: this._id,
      },
      undefined,
      options
    )
    .exec();

  for (let i = 0, il = transactions.length; i < il; i++) {
    transactions[i].voided = true;
    transactions[i].void_reason = this.void_reason;
  }

  await Promise.all(
    transactions.map((tx) => new transactionModel(tx).save(options))
  );

  const entry = book.entry(reason, null, this._id);

  for (const trans of transactions) {
    const meta: IAnyObject = {};
    Object.keys(trans.toObject()).forEach((key) => {
      if (key === "meta") {
        Object.keys(trans["meta"]).forEach((keyMeta) => {
          processMetaField(keyMeta, trans["meta"][keyMeta], meta);
        });
      } else {
        processMetaField(key, trans[key as keyof ITransaction], meta);
      }
    });

    if (trans.credit) {
      entry.debit(trans.account_path, trans.credit, meta);
    }
    if (trans.debit) {
      entry.credit(trans.account_path, trans.debit, meta);
    }
  }
  return entry.commit(options);
} as (
  this: TJournalDocument,
  book: Book,
  reason?: undefined | string,
  options?: IOptions
) => Promise<TJournalDocument>;

const preSave: PreSaveMiddlewareFunction<IJournal & Document> = async function (
  next
) {
  if (!(this.isModified("approved") && this.approved === true)) {
    return next();
  }

  const session = this.$session();

  const transactions = (await transactionModel
    .find({ _journal: this._id, approved: false }, undefined, { session })
    .exec()) as (Document & ITransaction)[];

  if (transactions.length === 0) {
    return next();
  }

  for (let i = 0, il = transactions.length; i < il; i++) {
    transactions[i].approved = true;
  }

  await Promise.all(transactions.map((tx) => tx.save({ session })));

  return next();
};

export type TJournalDocument<T extends IJournal = IJournal> = Omit<
  Document,
  "__v" | "id"
> &
  T & {
    void: (
      book: Book,
      reason?: undefined | null | string,
      options?: IOptions
    ) => Promise<TJournalDocument<T>>;
  };

type TJournalModel<T extends IJournal = IJournal> = Model<
  T,
  unknown,
  {
    void: (
      book: Book,
      reason?: undefined | null | string,
      options?: IOptions
    ) => Promise<TJournalDocument<T>>;
  }
>;

export let journalModel: TJournalModel;

export function setJournalSchema(schema: Schema, collection?: string) {
  delete connection.models["Medici_Journal"];

  schema.methods.void = voidJournal;
  schema.pre("save", preSave);

  journalModel = model("Medici_Journal", schema, collection) as TJournalModel;
}

typeof connection.models["Medici_Journal"] === "undefined" &&
  setJournalSchema(journalSchema);

import { connection, Schema, Document, Model, model, Types } from "mongoose";
import { isValidTransactionKey, ITransaction, transactionModel } from "./transaction";
import type { Book } from "../Book";
import { handleVoidMemo } from "../helper/handleVoidMemo";
import type { IAnyObject } from "../IAnyObject";
import type { IOptions } from "../IOptions";
import { JournalAlreadyVoidedError } from "../errors/JournalAlreadyVoidedError";
import { isPrototypeAttribute } from "../helper/isPrototypeAttribute";
import { MediciError } from "../errors/MediciError";

export interface IJournal {
  _id: Types.ObjectId;
  datetime: Date;
  memo: string;
  _transactions: Types.ObjectId[] | ITransaction[];
  book: string;
  voided?: boolean;
  void_reason?: string;
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
    voided: Boolean,
    void_reason: String,
  },
  { id: false, versionKey: false, timestamps: false }
);

function safeSetKeyToMetaObject(key: string, val: unknown, meta: IAnyObject): void {
  if (isPrototypeAttribute(key)) return;
  if (!isValidTransactionKey(key)) meta[key] = val;
}

const voidJournal = async function (book: Book, reason: undefined | null | string, options: IOptions) {
  if (this.voided) {
    throw new JournalAlreadyVoidedError();
  }

  reason = handleVoidMemo(reason, this.memo);

  // Not using options.session here as this read operation is not necessary to be in the ACID session.
  const transactions = await transactionModel.collection.find({ _journal: this._id }).toArray();
  if (transactions.length === 0)
    throw new MediciError(`Transactions for journal ${this._id} not found on book ${this.book}`);

  const entry = book.entry(reason, null, this._id);

  for (const transaction of transactions) {
    const newMeta: IAnyObject = {};
    for (const [key, value] of Object.entries(transaction)) {
      if (key === "meta") {
        for (const [keyMeta, valueMeta] of Object.entries(value)) {
          safeSetKeyToMetaObject(keyMeta, valueMeta, newMeta);
        }
      } else {
        safeSetKeyToMetaObject(key, value, newMeta);
      }
    }

    if (transaction.credit) {
      entry.debit(transaction.account_path, transaction.credit, newMeta);
    }
    if (transaction.debit) {
      entry.credit(transaction.account_path, transaction.debit, newMeta);
    }
  }

  // Set this journal to void with reason and also set all associated transactions
  const resultOne = await journalModel.collection.updateOne(
    { _id: this._id },
    { $set: { voided: true, void_reason: reason } },
    {
      session: options.session, // We must provide either session or writeConcern, but not both.
      writeConcern: options.session ? undefined : { w: 1, j: true }, // Ensure at least ONE node wrote to JOURNAL (disk)
    }
  );
  if (!resultOne.acknowledged) throw new MediciError(`Failed to void ${this.memo} journal on book ${this.book}`);
  if (resultOne.modifiedCount === 0) throw new MediciError(`Already voided ${this.memo} journal on book ${this.book}`);

  const resultMany = await transactionModel.collection.updateMany(
    { _journal: this._id },
    { $set: { voided: true, void_reason: reason } },
    {
      session: options.session, // We must provide either session or writeConcern, but not both.
      writeConcern: options.session ? undefined : { w: 1, j: true }, // Ensure at least ONE node wrote to JOURNAL (disk)
    }
  );
  if (!resultMany.acknowledged) throw new MediciError(`Failed to void ${this.memo} transactions on book ${this.book}`);
  if (resultMany.modifiedCount !== transactions.length)
    throw new MediciError(`Already voided ${this.memo} transactions on book ${this.book}`);

  return entry.commit(options);
} as (this: TJournalDocument, book: Book, reason?: undefined | string, options?: IOptions) => Promise<TJournalDocument>;

export type TJournalDocument<T extends IJournal = IJournal> = Omit<Document, "__v" | "id"> &
  T & {
    void: (book: Book, reason?: undefined | null | string, options?: IOptions) => Promise<TJournalDocument<T>>;
  };

type TJournalModel<T extends IJournal = IJournal> = Model<
  T,
  unknown,
  {
    void: (book: Book, reason?: undefined | null | string, options?: IOptions) => Promise<TJournalDocument<T>>;
  }
>;

export let journalModel: TJournalModel;

export function setJournalSchema(schema: Schema, collection?: string) {
  delete connection.models["Medici_Journal"];

  schema.methods.void = voidJournal;

  journalModel = model("Medici_Journal", schema, collection) as TJournalModel;
}

if (!connection.models["Medici_Journal"]) setJournalSchema(journalSchema);

import { connection, Schema, Document, Model, model, Types } from "mongoose";
import { ITransaction } from "./transaction";

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

export type TJournalDocument<T extends IJournal = IJournal> = Omit<Document, "__v" | "id"> & T;

type TJournalModel<T extends IJournal = IJournal> = Model<T>;

export let journalModel: TJournalModel;

export function setJournalSchema(schema: Schema, collection?: string) {
  delete connection.models["Medici_Journal"];

  journalModel = model("Medici_Journal", schema, collection) as TJournalModel;
}

(!connection.models["Medici_Journal"]) && setJournalSchema(journalSchema);

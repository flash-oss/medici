import { Schema, model } from "mongoose";

export interface IAccount {
  account: string;
  book: string;
  __v: number;
}

const trackAccountChanges = new Schema<IAccount>(
  {
    book: String,
    account: String,
    __v: Number,
  },
  { id: false, versionKey: false, timestamps: false }
);

trackAccountChanges.index(
  {
    account: 1,
    book: 1,
  },
  { unique: true }
);

export const trackAccountChangesModel = model<IAccount>(
  "Medici_Track_Account_Changes",
  trackAccountChanges
);

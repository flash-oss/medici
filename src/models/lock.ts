import { Schema, model } from "mongoose";

export interface IAccount {
  account: string;
  book: string;
  __v: number;
}

const lockSchema = new Schema<IAccount>(
  {
    book: String,
    account: String,
    __v: Number,
  },
  { id: false, versionKey: false, timestamps: false }
);

lockSchema.index(
  {
    account: 1,
    book: 1,
  },
  { unique: true }
);

export const lockModel = model<IAccount>(
  "Medici_Lock",
  lockSchema
);
import { Schema, model } from "mongoose";

export interface ILock {
  account: string;
  book: string;
  updatedAt: Date;
  __v: number;
}

const lockSchema = new Schema<ILock>(
  {
    book: String,
    account: String,
    updatedAt: Date,
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
lockSchema.index(
  {
    updatedAt: 1,
  },
  { expireAfterSeconds: 1 }
);

export const lockModel = model<ILock>("Medici_Lock", lockSchema);

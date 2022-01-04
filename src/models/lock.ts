import { Schema, model, Model, connection } from "mongoose";

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
  { expireAfterSeconds: 60 * 60 * 24 }
);

export let lockModel: Model<ILock>;

export function setLockSchema(schema: Schema, collection?: string) {
  delete connection.models["Medici_Lock"];

  lockModel = model("Medici_Lock", schema, collection);
}

(!connection.models["Medici_Lock"]) && setLockSchema(lockSchema);

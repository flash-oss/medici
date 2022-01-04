import { Schema, model, Model, connection, Types, FilterQuery } from "mongoose";
import { IAnyObject } from "../IAnyObject";
import { IOptions } from "../IOptions";

export interface IBalance {
  _id: Types.ObjectId;
  book: string;
  account?: string;
  transaction: Types.ObjectId;
  meta: IAnyObject;
  timestamp: Date;
  balance: number;
  createdAt: Date;
  expireAt: Date;
}

const balanceSchema = new Schema<IBalance>(
  {
    book: String,
    account: String,
    transaction: Types.ObjectId,
    meta: Schema.Types.Mixed,
    timestamp: Date,
    balance: Number,
    createdAt: Date,
    expireAt: Date,
  },
  { id: false, versionKey: false, timestamps: false }
);

balanceSchema.index({ account: 1, book: 1 });

balanceSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export let balanceModel: Model<IBalance>;

export function setBalanceSchema(schema: Schema, collection?: string) {
  delete connection.models["Medici_Balance"];

  balanceModel = model("Medici_Balance", schema, collection);
}

(!connection.models["Medici_Balance"]) && setBalanceSchema(balanceSchema);

export async function snapshotBalance(
  balanceData: IBalance & { expireInSec: number },
  options: IOptions
): Promise<boolean> {
  const balanceDoc = {
    book: balanceData.book,
    account: balanceData.account,
    meta: balanceData.meta,
    transaction: balanceData.transaction,
    timestamp: balanceData.timestamp,
    balance: balanceData.balance,
    createdAt: new Date(),
    expireAt: new Date(Date.now() + balanceData.expireInSec * 1000),
  };
  const result = await balanceModel.collection.insertOne(balanceDoc, {
    session: options.session,
    writeConcern: options.session ? undefined : { w: 1, j: true }, // Ensure at least ONE node wrote to JOURNAL (disk)
    forceServerObjectId: true,
  });
  return result.acknowledged;
}

export function getBestSnapshot(query: FilterQuery<IBalance>, options: IOptions): Promise<IBalance | null> {
  return balanceModel.collection.findOne(
    {
      book: query.book,
      account: query.account,
      meta: query.meta,
    },
    { sort: { _id: -1 }, session: options.session }
  ) as Promise<IBalance | null>;
}

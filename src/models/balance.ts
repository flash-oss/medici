import { Schema, model, Model, connection, Types, FilterQuery } from "mongoose";
import type { IAnyObject } from "../IAnyObject";
import type { IOptions } from "../IOptions";
import { flattenObject } from "../helper/flattenObject";

export interface IBalance {
  _id: Types.ObjectId;
  key: string;
  book: string;
  account?: string;
  transaction: Types.ObjectId;
  meta: IAnyObject;
  timestamp: Date;
  balance: number;
  notes: number;
  createdAt: Date;
  expireAt: Date;
}

const balanceSchema = new Schema<IBalance>(
  {
    key: String,
    book: String,
    account: String,
    transaction: Types.ObjectId,
    meta: Schema.Types.Mixed,
    timestamp: Date,
    balance: Number,
    notes: Number,
    createdAt: Date,
    expireAt: Date,
  },
  { id: false, versionKey: false, timestamps: false }
);

balanceSchema.index({ key: 1 });

balanceSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export let balanceModel: Model<IBalance>;

export function setBalanceSchema(schema: Schema, collection?: string) {
  delete connection.models["Medici_Balance"];

  balanceModel = model("Medici_Balance", schema, collection);
}

!connection.models["Medici_Balance"] && setBalanceSchema(balanceSchema);

export function constructKey(book: string, account?: string, meta?: IAnyObject): string {
  // Example of a simple key: "My book;Liabilities:12345"
  // Example of a complex key: "My book;Liabilities:Client,Liabilities:Client Pending;client.id:12345,approved:true"

  return [
    book,
    account,
    Object.entries(flattenObject(meta))
      .map(([key, value]) => key + ":" + value)
      .join(),
  ]
    .filter(Boolean)
    .join(";");
}

export async function snapshotBalance(
  balanceData: IBalance & { expireInSec: number },
  options: IOptions = {}
): Promise<boolean> {
  const key = constructKey(balanceData.book, balanceData.account, balanceData.meta);

  const balanceDoc = {
    key,
    book: balanceData.book,
    account: balanceData.account,
    meta: balanceData.meta,
    transaction: balanceData.transaction,
    timestamp: balanceData.timestamp,
    balance: balanceData.balance,
    notes: balanceData.notes,
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

export function getBestSnapshot(query: FilterQuery<IBalance>, options: IOptions = {}): Promise<IBalance | null> {
  const key = constructKey(query.book, query.account, query.meta);
  return balanceModel.collection.findOne(
    { key },
    { sort: { _id: -1 }, session: options.session }
  ) as Promise<IBalance | null>;
}

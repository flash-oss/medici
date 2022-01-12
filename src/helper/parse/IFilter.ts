import { Collection } from "mongoose";

export type IFilter = Parameters<Collection["find"]>[0];

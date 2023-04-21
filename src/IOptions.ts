import { ClientSession } from "mongoose";
import { ReadPreferenceLike } from "mongodb";

// aggregate of mongoose expects Record<string, unknown> type
export type IOptions = {
  session?: ClientSession;
  readPreference?: ReadPreferenceLike;
};

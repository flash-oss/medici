import type { ClientSession } from "mongoose";
import type { ReadPreferenceLike, Hint } from "mongodb";

// aggregate of mongoose expects Record<string, unknown> type
export type IOptions = {
  session?: ClientSession;
  readPreference?: ReadPreferenceLike;
  hint?: Hint;
};

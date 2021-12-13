import { ClientSession } from "mongoose";

// aggregate of mongoose expects Record<string, unknown> type
export type IOptions = {
  session?: ClientSession;
};

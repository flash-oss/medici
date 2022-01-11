import { journalModel } from "../models/journal";
import { lockModel } from "../models/lock";
import { transactionModel } from "../models/transaction";
import { balanceModel } from "../models/balance";

/**
 * Will execute mongoose model's `syncIndexes()` for all medici models.
 * WARNING! This will erase any custom (non-builtin) indexes you might have added.
 * @param [options] {{background: Boolean}}
 */
export async function syncIndexes(options?: { background: boolean }) {
  await journalModel.syncIndexes(options);
  await transactionModel.syncIndexes(options);
  await lockModel.syncIndexes(options);
  await balanceModel.syncIndexes(options);
}

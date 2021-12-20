import { journalModel } from "../models/journals";
import { trackAccountChangesModel } from "../models/trackAccountChanges";
import { transactionModel } from "../models/transactions";

export async function syncIndexes(options?: { background: boolean }) {
  await journalModel.syncIndexes(options);
  await transactionModel.syncIndexes(options);
  await trackAccountChangesModel.syncIndexes(options);
}

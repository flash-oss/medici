import { journalModel } from "../models/journals";
import { trackAccountChangesModel } from "../models/trackAccountChanges";
import { transactionModel } from "../models/transactions";

export async function initModels() {
  await journalModel.init();
  await transactionModel.init();
  await trackAccountChangesModel.init();
}

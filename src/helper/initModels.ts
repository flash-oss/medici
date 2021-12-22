import { journalModel } from "../models/journals";
import { lockModel } from "../models/locks";
import { transactionModel } from "../models/transactions";

export async function initModels() {
  await journalModel.init();
  await transactionModel.init();
  await lockModel.init();
}

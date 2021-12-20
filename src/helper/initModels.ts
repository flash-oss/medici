import { journalModel } from "../models/journals";
import { transactionModel } from "../models/transactions";

export async function initModels() {
  await journalModel.init();
  await transactionModel.init();
}

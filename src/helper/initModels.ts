import { journalModel } from "../models/journal";
import { lockModel } from "../models/lock";
import { transactionModel } from "../models/transaction";

export async function initModels() {
  await journalModel.init();
  await transactionModel.init();
  await lockModel.init();
}

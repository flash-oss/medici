import { journalModel } from "../models/journal";
import { transactionModel } from "../models/transaction";
import { lockModel } from "../models/lock";
import { balanceModel } from "../models/balance";

export async function initModels() {
  await journalModel.init();
  await transactionModel.init();
  await lockModel.init();
  await balanceModel.init();
}

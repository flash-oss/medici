import { Book } from "./Book";
import {
  isValidTransactionKey,
  ITransaction,
  transactionModel,
} from "./models/transactions";
import { TransactionError } from "./TransactionError";
import { IJournal, journalModel } from "./models/journals";
import type { IOptions } from "./IOptions";
import { ObjectId as TObjectId } from "mongoose";

export class Entry {
  book: Book;
  journal: IJournal & { _original_journal?: TObjectId };
  transactions: ITransaction[] = [];

  static write(
    book: Book,
    memo: string,
    date = null as Date | null,
    original_journal = null as TObjectId | null
  ): Entry {
    return new this(book, memo, date, original_journal);
  }

  constructor(
    book: Book,
    memo: string,
    date: Date | null,
    original_journal: TObjectId | null
  ) {
    this.book = book;
    this.journal = new journalModel();
    this.journal.memo = memo;

    if (original_journal) {
      this.journal._original_journal = original_journal;
    }

    if (!date) {
      date = new Date();
    }
    this.journal.datetime = date;
    this.journal.book = this.book.name;
    this.transactions = [];
    this.journal.approved = true;
  }

  setApproved(value: boolean): Entry {
    this.journal.approved = value;
    return this;
  }

  private transact(
    type: -1 | 1,
    account_path: string | string[],
    amount: number | string,
    extra = null as { [key: string]: any } | null
  ): Entry {
    if (typeof account_path === "string") {
      account_path = account_path.split(":");
    }

    if (account_path.length > 3) {
      throw new Error("Account path is too deep (maximum 3)");
    }

    const credit =
      type === 1
        ? typeof amount === "string"
          ? parseFloat(amount)
          : amount
        : 0.0;
    const debit =
      type === -1
        ? typeof amount === "string"
          ? parseFloat(amount)
          : amount
        : 0.0;

    const transaction: ITransaction = {
      _id: undefined,
      _journal: this.journal._id,
      _original_journal: this.journal._original_journal,
      account_path,
      accounts: account_path.join(":"),
      approved: false,
      book: this.book.name,
      credit,
      datetime: this.journal.datetime,
      debit,
      memo: this.journal.memo,
      meta: {},
      timestamp: new Date(),
      void_reason: undefined,
      voided: false,
    };

    if (extra) {
      Object.keys(extra).forEach((key) => {
        if (isValidTransactionKey(key)) {
          // @ts-ignore dts-bundle-generator throws TS2322
          transaction[key] = extra[key];
        } else {
          transaction.meta[key] = extra[key];
        }
      });
    }
    this.transactions.push(transaction as ITransaction);

    return this;
  }

  credit(
    account_path: string | string[],
    amount: number | string,
    extra = null as { [key: string]: any } | null
  ): Entry {
    return this.transact(1, account_path, amount, extra);
  }

  debit(
    account_path: string | string[],
    amount: number | string,
    extra = null as { [key: string]: any } | null
  ): Entry {
    return this.transact(-1, account_path, amount, extra);
  }

  /**
   * Save a transaction to the database
   * @param transaction
   * @returns {Promise}
   */
  saveTransaction(
    transaction: ITransaction,
    options = {} as IOptions
  ): Promise<any> {
    const model = new transactionModel(transaction);
    this.journal._transactions.push(model._id);
    return model.save(options);
  }

  async commit(options = {} as IOptions) {
    let total = 0.0;
    for (let i = 0, il = this.transactions.length; i < il; i++) {
      // set approved on transactions to approved-value on journal
      this.transactions[i].approved = this.journal.approved;
      // sum the value of the transaction
      total += this.transactions[i].credit - this.transactions[i].debit;
    }

    // Hello JavaScript. Your math rounding skill is mesmerising.
    if (total > -1e-7 && total < 1e-7) total = 0;
    // Medici is about money counting. It should probably use more precise floating point number structure.
    // However, for now we use JS built-in Number. Hence Medici limitations are coming from Number.MAX_SAFE_INTEGER === 9007199254740991
    // Here are the limitations:
    // * You can safely add values up to 1 billion and down to 0.000001.
    // * Anything more than 1 billion or less than 0.000001 is not guaranteed and might throw the below error.

    if (total !== 0) {
      throw new TransactionError(
        "INVALID_JOURNAL: can't commit non zero total",
        total
      );
    }

    try {
      await Promise.all(
        this.transactions.map((tx) => this.saveTransaction(tx, options))
      );
      // @ts-ignore
      return await this.journal.save(options);
    } catch (err) {
      if (!options.session) {
        transactionModel
          .deleteMany({
            _journal: this.journal._id,
          })
          .catch((e) =>
            console.error(
              `Can't delete txs for journal ${this.journal._id}. Medici ledger consistency got harmed.`,
              e
            )
          );
      }
      throw new Error(`Failure to save journal: ${(err as Error).message}`);
    }
  }
}

export default Entry;

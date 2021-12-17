import { Types } from "mongoose";
import { Book } from "./Book";
import {
  isValidTransactionKey,
  ITransaction,
  transactionModel,
} from "./models/transactions";
import { TransactionError } from "./TransactionError";
import { IJournal, journalModel, TJournalDocument } from "./models/journals";
import type { IOptions } from "./IOptions";
import type { IAnyObject } from "./IAnyObject";

export class Entry<
  U extends ITransaction = ITransaction,
  J extends IJournal = IJournal
> {
  book: Book;
  journal: TJournalDocument<J> & { _original_journal?: Types.ObjectId };
  transactions: U[] = [];

  static write<U extends ITransaction, J extends IJournal>(
    book: Book,
    memo: string,
    date: Date | null,
    original_journal: string | Types.ObjectId | null
  ): Entry<U, J> {
    return new this(book, memo, date, original_journal);
  }

  constructor(
    book: Book,
    memo: string,
    date: Date | null,
    original_journal: string | Types.ObjectId | null
  ) {
    this.book = book;
    this.journal = new journalModel() as TJournalDocument<J> & {
      _original_journal?: Types.ObjectId;
    };
    this.journal.memo = memo;

    if (original_journal) {
      this.journal._original_journal =
        typeof original_journal === "string"
          ? new Types.ObjectId(original_journal)
          : original_journal;
    }

    if (!date) {
      date = new Date();
    }
    this.journal.datetime = date;
    this.journal.book = this.book.name;
    this.transactions = [];
    this.journal.approved = true;
  }

  setApproved(value: boolean): Entry<U, J> {
    this.journal.approved = value;
    return this;
  }

  private transact(
    type: -1 | 1,
    account_path: string | string[],
    amount: number | string,
    extra: (Partial<U> & IAnyObject) | null
  ): Entry<U, J> {
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
      _id: new Types.ObjectId(),
      _journal: this.journal._id,
      _original_journal: this.journal._original_journal,
      account_path,
      accounts: account_path.join(":"),
      approved: true,
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
      const keys = Object.keys(extra);

      for (let i = 0, il = keys.length; i < il; i++) {
        const key = keys[i];
        if (isValidTransactionKey(key)) {
          transaction[key] = extra[key] as never;
        } else {
          transaction.meta[key] = extra[key];
        }
      }
    }
    this.transactions.push(transaction as U);
    (this.journal._transactions as Types.ObjectId[]).push(transaction._id);

    return this;
  }

  credit<T extends IAnyObject = IAnyObject>(
    account_path: string | string[],
    amount: number | string,
    extra = null as (T & Partial<U>) | null
  ): Entry<U, J> {
    return this.transact(1, account_path, amount, extra);
  }

  debit<T extends IAnyObject = IAnyObject>(
    account_path: string | string[],
    amount: number | string,
    extra = null as (T & Partial<U>) | null
  ): Entry<U, J> {
    return this.transact(-1, account_path, amount, extra);
  }

  async commit(options = {} as IOptions): Promise<Entry<U, J>["journal"]> {
    let total = 0.0;
    for (let i = 0, il = this.transactions.length; i < il; i++) {
      // set approved on transactions to approved-value on journal
      this.transactions[i].approved = this.journal.approved;
      // sum the value of the transaction
      total += this.transactions[i].credit - this.transactions[i].debit;
    }

    total = parseFloat(total.toFixed(this.book.precision));

    if (total !== 0) {
      throw new TransactionError(
        "INVALID_JOURNAL: can't commit non zero total",
        total
      );
    }

    try {
      for (let i = 0, il = this.transactions.length; i < il; i++) {
        await new transactionModel(this.transactions[i]).save(options);
      }

      await this.journal.save(options);

      return this.journal;
    } catch (err) {
      if (!options.session) {
        try {
          await transactionModel
            .deleteMany({
              _journal: this.journal._id,
            })
            .exec();
        } catch (e) {
          console.error(
            `Can't delete txs for journal ${this.journal._id}. Medici ledger consistency got harmed.`,
            e
          );
        }
      }
      throw new Error(`Failure to save journal: ${(err as Error).message}`);
    }
  }
}

export default Entry;

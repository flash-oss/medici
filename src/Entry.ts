import { Book } from "./Book";
import { IJournal } from "./models/journals";
import { isValidTransactionKey, ITransaction } from "./models/transactions";
import { TransactionError } from "./TransactionError";

export class Entry {
  book: Book;
  journal: IJournal & { _original_journal?: any };
  transactions: ITransaction[] = [];

  static write(book: Book, memo: string, date = null as unknown as Date, original_journal = null as any) {
    return new this(book, memo, date, original_journal);
  }

  constructor(book: Book, memo: string, date: Date, original_journal: any) {
    this.book = book;
    // @ts-ignore
    const { journalModel } = this.book;
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
    // this.transactionModels = [];
    this.journal.approved = true;
  }

  setApproved(value: boolean) {
    this.journal.approved = value;
    return this;
  }

  credit(account_path: string | string[], amount: number, extra = null as {[key:string]: any;} | null) {
    const credit = typeof amount === "string" ? parseFloat(amount) : amount;
    if (typeof account_path === "string") {
      account_path = account_path.split(":");
    }

    if (account_path.length > 3) {
      throw "Account path is too deep (maximum 3)";
    }

    const transaction: Partial<ITransaction> = {
      account_path,
      accounts: account_path.join(':'),
      credit,
      debit: 0.0,
      book: this.book.name,
      memo: this.journal.memo,
      _journal: this.journal._id,
      datetime: this.journal.datetime,
      _original_journal: this.journal._original_journal,
      timestamp: new Date()
    };

    // Loop through the meta and see if there are valid keys on the schema
    const meta: { [key: string]: any; } = {};
    if (extra) {
      Object.keys(extra).forEach(key => {
        const val = extra[key];
        if (isValidTransactionKey(key)) {
          // @ts-ignore
          transaction[key] = val;
        } else {
          meta[key] = val;
        }
      });
    }
    transaction.meta = meta;
    this.transactions.push(transaction as ITransaction);

    return this;
  }

  debit(account_path: string | string[], amount: number | string, extra = null as {[key:string]: any;} | null) {
    const debit = typeof amount === "string" ? parseFloat(amount) : amount;
    if (typeof account_path === "string") {
      account_path = account_path.split(":");
    }
    if (account_path.length > 3) {
      throw "Account path is too deep (maximum 3)";
    }

    const transaction: Partial<ITransaction> = {
      account_path,
      accounts: account_path.join(':'),
      credit: 0.0,
      debit,
      _journal: this.journal._id,
      book: this.book.name,
      memo: this.journal.memo,
      datetime: this.journal.datetime,
      _original_journal: this.journal._original_journal
    };

    // Loop through the meta and see if there are valid keys on the schema
    const meta: { [key: string]: any; } = {};
    if (extra) {
      Object.keys(extra).forEach(key => {
        const val = extra[key];
        if (isValidTransactionKey(key)) {
          // @ts-ignore
          transaction[key] = val;
        } else {
          meta[key] = val;
        }
      });
    }

    transaction.meta = meta;
    this.transactions.push(transaction as ITransaction);

    return this;
  }

  /**
   * Save a transaction to the database
   * @param transaction
   * @returns {Promise}
   */
  saveTransaction(transaction: ITransaction) {
    // @ts-ignore
    const modelClass = this.book.transactionModel;

    const model = new modelClass(transaction);
    this.journal._transactions.push(model._id);
    return model.save();
  }

  async commit() {
    // First of all, set approved on transactions to approved on journal
    for (const tx of this.transactions) {
      tx.approved = this.journal.approved;
    }
    // this.transactionsSaved = 0;
    let total = 0.0;
    for (const tx of this.transactions) {
      total += tx.credit;
      total -= tx.debit;
    }

    // Hello JavaScript. Your math rounding skill is mesmerising.
    if (total > -1e-7 && total < 1e-7) total = 0;
    // Medici is about money counting. It should probably use more precise floating point number structure.
    // However, for now we use JS built-in Number. Hence Medici limitations are coming from Number.MAX_SAFE_INTEGER === 9007199254740991
    // Here are the limitations:
    // * You can safely add values up to 1 billion and down to 0.000001.
    // * Anything more than 1 billion or less than 0.000001 is not guaranteed and might throw the below error.

    if (total !== 0) {
      throw new TransactionError("INVALID_JOURNAL: can't commit non zero total", total);
    }

    try {
      await Promise.all(this.transactions.map(tx => this.saveTransaction(tx)));
      // @ts-ignore
      return await this.journal.save();
    } catch (err) {
      // @ts-ignore
      this.book.transactionModel
        .deleteMany({
          _journal: this.journal._id
        })
        .catch(e =>
          console.error(`Can't delete txs for journal ${this.journal._id}. Medici ledger consistency got harmed.`, e)
        );
      throw new Error(`Failure to save journal: ${(err as Error).message}`);
    }
  }
}

export default Entry;
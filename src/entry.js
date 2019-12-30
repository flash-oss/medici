module.exports = class Entry {
  static write(book, memo, date = null, original_journal = null) {
    return new this(book, memo, date, original_journal);
  }

  constructor(book, memo, date, original_journal) {
    this.book = book;
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
    this.transactionModels = [];
    this.journal.approved = true;
  }

  setApproved(bool) {
    this.journal.approved = bool;
    return this;
  }

  credit(account_path, amount, extra = null) {
    amount = parseFloat(amount);
    if (typeof account_path === "string") {
      account_path = account_path.split(":");
    }

    if (account_path.length > 3) {
      throw "Account path is too deep (maximum 3)";
    }

    const transaction = {
      account_path,
      accounts: account_path.join(":"),
      credit: amount,
      debit: 0.0,
      book: this.book.name,
      memo: this.journal.memo,
      _journal: this.journal._id,
      datetime: this.journal.datetime,
      _original_journal: this.journal._original_journal,
      timestamp: new Date()
    };

    // Loop through the meta and see if there are valid keys on the schema
    const validKeys = Object.keys(this.book.transactionModel.schema.paths);
    const meta = {};
    Object.keys(extra || {}).forEach(key => {
      const val = extra[key];
      if (validKeys.indexOf(key) >= 0) {
        transaction[key] = val;
      } else {
        meta[key] = val;
      }
    });
    transaction.meta = meta;
    this.transactions.push(transaction);

    return this;
  }

  debit(account_path, amount, extra = null) {
    amount = parseFloat(amount);
    if (typeof account_path === "string") {
      account_path = account_path.split(":");
    }
    if (account_path.length > 3) {
      throw "Account path is too deep (maximum 3)";
    }

    const transaction = {
      account_path,
      accounts: account_path.join(":"),
      credit: 0.0,
      debit: amount,
      _journal: this.journal._id,
      book: this.book.name,
      memo: this.journal.memo,
      datetime: this.journal.datetime,
      _original_journal: this.journal._original_journal
    };

    // Loop through the meta and see if there are valid keys on the schema
    const validKeys = Object.keys(this.book.transactionModel.schema.paths);
    const meta = {};
    Object.keys(extra || {}).forEach(key => {
      const val = extra[key];
      if (validKeys.indexOf(key) >= 0) {
        transaction[key] = val;
      } else {
        meta[key] = val;
      }
    });

    this.transactions.push(transaction);
    transaction.meta = meta;

    return this;
  }

  /**
   * Save a transaction to the database
   * @param transaction
   * @returns {Promise}
   */
  saveTransaction(transaction) {
    const modelClass = this.book.transactionModel;

    const model = new modelClass(transaction);
    this.journal._transactions.push(model._id);
    return model.save();
  }

  commit() {
    // First of all, set approved on transactions to approved on journal
    for (let tx of this.transactions) {
      tx.approved = this.journal.approved;
    }
    this.transactionsSaved = 0;
    let total = 0.0;
    for (let tx of this.transactions) {
      total += tx.credit;
      total -= tx.debit;
    }

    // Hello JavaScript. Your math rounding skill is mesmerising.
    if (total > -1e-7 && total < 1e-7) total = 0;
    // Medici is about money counting. It should probably use more precise floating point number structure.
    // However, for now we use JS built-in Number. Hence Medici limitations are coming from Number.MAX_SAFE_INTEGER === 9007199254740991
    // Here are the limitations:
    // * You can safely add values up to 1 billion and down to 0.000001.
    // * Anything more than 1 billion or less than 0.000001 is not guaranteed and will throw the below error.

    if (total !== 0) {
      const err = new Error("INVALID_JOURNAL: can't commit non zero total");
      err.code = 400;
      err.total = total;
      console.error("Journal is invalid. Total is:", total);
      return Promise.reject(err);
    } else {
      return Promise.all(
        this.transactions.map(tx => this.saveTransaction(tx))
      ).then(() => {
        return this.journal
          .save()
          .then(() => this.journal)
          .catch(err => {
            this.book.transactionModel.remove({
              _journal: this.journal._id
            });
            throw new Error(`Failure to save journal: ${err.message}`);
          });
      });
    }
  }
};

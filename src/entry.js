module.exports = class Entry {
	static write(book, memo, date=null,original_journal=null) {
		return new (this)(book, memo, date, original_journal);
	}

	constructor(book, memo, date,original_journal) {
		this.book = book;
		var { journalModel } = this.book;
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

	credit(account_path, amount, extra=null) {
		amount = parseFloat(amount);
		if (typeof account_path === 'string') {
			account_path = account_path.split(':');
		}

		if (account_path.length > 3) {
			throw "Account path is too deep (maximum 3)";
		}

		var transaction = {
			account_path,
			accounts:account_path.join(':'),
			credit:amount,
			debit:0.0,
			book:this.book.name,
			memo:this.journal.memo,
			_journal:this.journal._id,
			datetime:this.journal.datetime,
			_original_journal:this.journal._original_journal,
			timestamp:new Date()
		};

		// Loop through the meta and see if there are valid keys on the schema
		var keys = Object.keys(this.book.transactionModel.schema.paths);
		var meta = {};
		for (var key in extra) {
			var val = extra[key];
			if (keys.indexOf(key) >= 0) {
				transaction[key] = val;
			} else {
				meta[key] = val;
			}
		}
		transaction.meta = meta;
		this.transactions.push(transaction);

		return this;
	}

	debit(account_path, amount, extra=null) {
		amount = parseFloat(amount);
		if (typeof account_path === 'string') {
			account_path = account_path.split(':');
		}
		if (account_path.length > 3) {
			throw "Account path is too deep (maximum 3)";
		}

		var transaction = {
			account_path,
			accounts:account_path.join(':'),
			credit:0.0,
			debit:amount,
			_journal:this.journal._id,
			book:this.book.name,
			memo:this.journal.memo,
			datetime:this.journal.datetime,
			_original_journal:this.journal._original_journal
		};

		// Loop through the meta and see if there are valid keys on the schema
		var keys = Object.keys(this.book.transactionModel.schema.paths);
		var meta = {};
		for (var key in extra) {
			var val = extra[key];
			if (keys.indexOf(key) >= 0) {
				transaction[key] = val;
			} else {
				meta[key] = val;
			}
		}

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
		var modelClass = this.book.transactionModel;

		var model = new modelClass(transaction);
		this.journal._transactions.push(model._id);
		return model.save();
	}

	commit() {
		// First of all, set approved on transactions to approved on journal
		for (var tx of this.transactions) {
			tx.approved = this.journal.approved;
		}
		this.transactionsSaved = 0;
		var total = 0.0;
		for (var tx of this.transactions) {
			total += tx.credit;
			total -= tx.debit;
		}

		if ((total > 0) || (total < 0)) {
			var err = new Error("INVALID_JOURNAL");
			err.code = 400;
			console.error('Journal is invalid. Total is:', total);
			return Promise.reject(err)
		} else {
			return Promise.all(this.transactions.map(tx => this.saveTransaction(tx)))
            .then(() => {
				return this.journal
                .save()
                .then(() => this.journal)
                .catch(err => {
                    this.book.transactionModel.remove({
                        _journal:this.journal._id});
                    throw new Error(`Failure to save journal: ${err.message}`);
                });
			});
		}
	}
};

/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let Entry;
const Q = require('q');
module.exports = (Entry = class Entry {
	static write(book, memo, date=null,original_journal=null) {
		return new (this)(book, memo, date, original_journal);
	}
	constructor(book, memo, date,original_journal) {
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
	credit(account_path, amount, extra=null) {
		amount = parseFloat(amount);
		if (typeof account_path === 'string') {
			account_path = account_path.split(':');
		}
		
		if (account_path.length > 3) {
			throw "Account path is too deep (maximum 3)";
		}

		const transaction = {
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
		const keys = Object.keys(this.book.transactionModel.schema.paths);
		const meta = {};
		for (let key in extra) {
			const val = extra[key];
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
			
		const transaction = {
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
		const keys = Object.keys(this.book.transactionModel.schema.paths);
		const meta = {};
		for (let key in extra) {
			const val = extra[key];
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


	saveTransaction(transaction) {
		const d = Q.defer();

		const modelClass = this.book.transactionModel;

		const model = new modelClass(transaction);
		this.journal._transactions.push(model._id);
		model.save(function(err, res) {
			if (err) {
				return d.reject(err);
			} else {
				return d.resolve(res);
			}
		});
		return d.promise;
	}
	commit(success) {
		const deferred = Q.defer();

		// First of all, set approved on transactions to approved on journal
		for (var transaction of Array.from(this.transactions)) {
			transaction.approved = this.journal.approved;
		}
		this.transactionsSaved = 0;
		let total = 0.0;
		for (transaction of Array.from(this.transactions)) {
			total += transaction.credit;
			total -= transaction.debit;
		}
		if ((total > 0) || (total < 0)) {
			const err = new Error("INVALID_JOURNAL");
			err.code = 400;
			console.error('Journal is invalid. Total is:', total);
			deferred.reject(err);
		} else {
			const saves = [];
			for (let trans of Array.from(this.transactions)) {
				saves.push(this.saveTransaction(trans));
			}

			Q.all(saves).then(() => {
				return this.journal.save((err, result) => {
					if (err) {
						this.book.transactionModel.remove({ 
							_journal:this.journal._id});
						return deferred.reject(new Error('Failure to save journal'));
					} else {
						deferred.resolve(this.journal);
						if (success != null) { return success(this.journal); }
					}
				});
			}
			, err => deferred.reject(err));
		}


		return deferred.promise;
	}
});

		
		
const mongoose = require('mongoose');
const entry = require('./entry');
const Q = require('q');
module.exports = class Book {
	constructor(name) {
		this.name = name;
		this.transactionModel = mongoose.model('Medici_Transaction');
		this.journalModel = mongoose.model('Medici_Journal');
	}

	entry(memo, date=null, original_journal=null) {
		return entry.write(this, memo, date,original_journal);
	}

    /**
	 * Turn query into an object readable by MongoDB.
	 *
     * @param query {{account: {acct, subacct, subsubacct}, start_date, month_date, meta}}
     * @returns {Object}
     */
	parseQuery(query) {
		let account, end_date, start_date;
		const parsed = {};
		if (account = query.account) {
			let accounts, i;
			if (account instanceof Array) {

				const $or = [];
				for (let acct of account) {
					accounts = acct.split(':');
					const match = {};
					for (i = 0; i < accounts.length; i++) {
						const a = accounts[i];
						match[`account_path.${i}`] = a;
					}
					$or.push(match);
				}
				parsed['$or'] = $or;
			} else {
				accounts = account.split(':');
				for (i = 0; i < accounts.length; i++) {
					const acct = accounts[i];
					parsed[`account_path.${i}`] = acct;
				}
			}
			delete query.account;
		}

		if (query._journal) {
			parsed['_journal'] = query._journal;
		}

		if (query.start_date && query.end_date) {
			start_date = new Date(parseInt(query.start_date));
			end_date = new Date(parseInt(query.end_date));
			parsed['datetime'] = {
				$gte:start_date,
				$lte:end_date
			};
			delete query.start_date;
			delete query.end_date;
		} else if (query.start_date) {
			parsed['datetime'] =
				{$gte:new Date(parseInt(query.start_date))};
			delete query.start_date;
		} else if (query.end_date) {
			parsed['datetime'] =
				{$lte:new Date(parseInt(query.end_date))};
			delete query.end_date;
		}

		const keys = Object.keys(this.transactionModel.schema.paths);
		for (let key in query) {
			let val = query[key];
			if (keys.indexOf(key) >= 0) {
				// If it starts with a _ assume it's a reference
				if ((key.substr(0, 1) === '_') && val instanceof String) {

					val = mongoose.Types.ObjectId(val);
				}
				parsed[key] = val;
			} else {
				// Assume *_id is an OID
				if (key.indexOf('_id') > 0) {
					val = mongoose.Types.ObjectId(val);
				}

				parsed[`meta.${key}`] = val;
			}
		}


		// Add the book
		parsed.book = this.name;

		parsed.approved = true;
		return parsed;
	}

	balance(query) {
		let pagination;
		const deferred = Q.defer();

		if (query.perPage) {
			pagination = {
				perPage:query.perPage,
				page: query.page ? query.page : 1
			};

			delete query.perPage;
			delete query.page;
		}
		query = this.parseQuery(query);
		const match =
			{$match:query};

		const project = {
			$project: {
				debit:'$debit',
				credit:'$credit',
				datetime:'$datetime',
				timestamp:'$timestamp'
			}
		};
		const group = {
			$group: {
				_id:'1',
				credit: {
					$sum:'$credit'
				},
				debit: {
					$sum:'$debit'
				},
				count: {
					$sum:1
				}
			}
		};
		if (pagination) {
			const skip =
				{$skip:(pagination.page - 1) * pagination.perPage};
			const sort = {
				$sort: {
					'datetime':-1,
					'timestamp':-1
				}
			};
			this.transactionModel.aggregate(match, project, sort, skip, group, function(err, result) {

				if (err) {
					return deferred.reject(err);
				} else {
					result = result.shift();
					if ((result == null)) {
						return deferred.resolve({
							balance:0,
							notes:0
						});
					}

					const total = result.credit - (result.debit);


					return deferred.resolve({
						balance:total,
						notes:result.count
					});
				}
			});

		} else {
			this.transactionModel.aggregate(match, project, group, function(err, result) {
				if (err) {
					return deferred.reject(err);
				} else {
					result = result.shift();
					if ((result == null)) {
						return deferred.resolve({
							balance:0,
							notes:0
						});
					}

					const total = result.credit - (result.debit);
					return deferred.resolve({
						balance:total,
						notes:result.count
					});
				}
			});
		}


		return deferred.promise;
	}

	ledger(query, populate=null) {
		let pagination;
		const deferred = Q.defer();

		// Pagination
		if (query.perPage) {
			pagination = {
				perPage:query.perPage,
				page: query.page ? query.page : 1
			};

			delete query.perPage;
			delete query.page;
		}
		query = this.parseQuery(query);
		const q = this.transactionModel.find(query);

		if (pagination) {
			this.transactionModel.count(query, (err, count) => {
				q.skip((pagination.page - 1) * pagination.perPage).limit(pagination.perPage);
				q.sort({
					datetime:-1,
					timestamp:-1
				});
				if (populate) {
					for (let pop of Array.from(populate)) {
						q.populate(pop);
					}
				}
				return q.exec(function(err, results) {
					if (err) {
						return deferred.reject(err);
					} else {
						return deferred.resolve({
							results,
							total:count
						});
					}
				});
			});
		} else {
			q.sort({
				datetime:-1,
				timestamp:-1
			});
			if (populate) {
				for (let pop of Array.from(populate)) {
					q.populate(pop);
				}
			}
			q.exec(function(err, results) {
				if (err) {
					return deferred.reject(err);
				} else {
					const returnVal = {
						results,
						total:results.length
					};
					return deferred.resolve(returnVal);
				}
			});
		}

		return deferred.promise;
	}

	void(journal_id, reason) {
		const deferred = Q.defer();

		this.journalModel.findById(journal_id, (err, journal) => {
			if (err) {
				return deferred.reject(err);
			} else {
				return journal.void(this, reason).then(() => deferred.resolve()
				, err => deferred.reject(err));
			}
		});

		return deferred.promise;
	}

	listAccounts() {
		const deferred = Q.defer();

		this.transactionModel.find({
			book:this.name})
		.distinct('accounts', function(err, results) {
			// Make array
			if (err) {
				console.error(err);
				deferred.reject(err);
			} else {
				const final = [];
				for (let result of results) {
					const paths = result.split(':');
					const prev = [];
					for (let acct of paths) {
						prev.push(acct);
						final.push(prev.join(':'));
					}
				}
				const uniques = Array.from(new Set(final));
				deferred.resolve(uniques);
			}
		});
		return deferred.promise;
	}
};

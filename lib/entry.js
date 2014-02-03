var Entry, Q, mongoose, _;

_ = require('underscore');

mongoose = require('mongoose');

Q = require('q');

module.exports = Entry = (function() {
  Entry.write = function(book, memo, date, original_journal) {
    if (date == null) {
      date = null;
    }
    if (original_journal == null) {
      original_journal = null;
    }
    return new this(book, memo, date, original_journal);
  };

  function Entry(book, memo, date, original_journal) {
    var journalModel;
    this.book = book;
    journalModel = this.book.journalModel;
    this.journal = new journalModel();
    this.journal.memo = memo;
    if (original_journal) {
      this.journal._original_journal = original_journal;
    }
    if (!date) {
      date = new Date();
    }
    this.journal.datetime = date;
    this.transactions = [];
    this.transactionModels = [];
    this.journal.approved = true;
  }

  Entry.prototype.setApproved = function(bool) {
    this.journal.approved = bool;
    return this;
  };

  Entry.prototype.credit = function(account_path, amount, extra) {
    var key, keys, meta, transaction, val;
    if (extra == null) {
      extra = null;
    }
    amount = parseFloat(amount);
    if (typeof account_path === 'string') {
      account_path = account_path.split(':');
    }
    if (account_path.length > 3) {
      throw "Account path is too deep (maximum 3)";
    }
    transaction = {
      account_path: account_path,
      accounts: account_path.join(':'),
      credit: amount,
      debit: 0.0,
      book: this.book.name,
      memo: this.journal.memo,
      _journal: this.journal._id,
      datetime: this.journal.datetime,
      _original_journal: this.journal._original_journal,
      timestamp: new Date()
    };
    keys = _.keys(this.book.transactionModel.schema.paths);
    meta = {};
    for (key in extra) {
      val = extra[key];
      if (keys.indexOf(key) >= 0) {
        transaction[key] = val;
      } else {
        meta[key] = val;
      }
    }
    transaction.meta = meta;
    this.transactions.push(transaction);
    return this;
  };

  Entry.prototype.debit = function(account_path, amount, extra) {
    var key, keys, meta, transaction, val;
    if (extra == null) {
      extra = null;
    }
    amount = parseFloat(amount);
    if (typeof account_path === 'string') {
      account_path = account_path.split(':');
    }
    if (account_path.length > 3) {
      throw "Account path is too deep (maximum 3)";
    }
    transaction = {
      account_path: account_path,
      accounts: account_path.join(':'),
      credit: 0.0,
      debit: amount,
      _journal: this.journal._id,
      book: this.book.name,
      memo: this.journal.memo,
      datetime: this.journal.datetime,
      _original_journal: this.journal._original_journal
    };
    keys = _.keys(this.book.transactionModel.schema.paths);
    meta = {};
    for (key in extra) {
      val = extra[key];
      if (keys.indexOf(key) >= 0) {
        transaction[key] = val;
      } else {
        meta[key] = val;
      }
    }
    this.transactions.push(transaction);
    transaction.meta = meta;
    return this;
  };

  Entry.prototype.saveTransaction = function(transaction) {
    var d, model, modelClass;
    d = Q.defer();
    modelClass = this.book.transactionModel;
    model = new modelClass(transaction);
    this.journal._transactions.push(model._id);
    model.save(function(err, res) {
      if (err) {
        return d.reject(err);
      } else {
        return d.resolve(res);
      }
    });
    return d.promise;
  };

  Entry.prototype.commit = function(success) {
    var deferred, err, saves, total, trans, transaction, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2,
      _this = this;
    deferred = Q.defer();
    _ref = this.transactions;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      transaction = _ref[_i];
      transaction.approved = this.journal.approved;
    }
    this.transactionsSaved = 0;
    total = 0.0;
    _ref1 = this.transactions;
    for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
      transaction = _ref1[_j];
      total += transaction.credit;
      total -= transaction.debit;
    }
    if (total > 0 || total < 0) {
      err = new Error("INVALID_JOURNAL");
      err.code = 400;
      console.error('Journal is invalid. Total is:', total);
      deferred.reject(err);
    } else {
      saves = [];
      _ref2 = this.transactions;
      for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
        trans = _ref2[_k];
        saves.push(this.saveTransaction(trans));
      }
      Q.all(saves).then(function() {
        return _this.journal.save(function(err, result) {
          if (err) {
            _this.book.transactionModel.remove({
              _journal: _this.journal._id
            });
            return deferred.reject(new Error('Failure to save journal'));
          } else {
            deferred.resolve(_this.journal);
            if (success != null) {
              return success(_this.journal);
            }
          }
        });
      }, function(err) {
        return deferred.reject(err);
      });
    }
    return deferred.promise;
  };

  return Entry;

})();

var Q, Schema, book, entry, err, journalSchema, mongoose, transactionSchema, _;

entry = require('./lib/entry');

book = require('./lib/book');

mongoose = require('mongoose');

Schema = mongoose.Schema;

Q = require('q');

_ = require('underscore');

try {
  mongoose.model('Medici_Transaction');
} catch (_error) {
  err = _error;
  transactionSchema = new Schema({
    credit: Number,
    debit: Number,
    meta: Schema.Types.Mixed,
    datetime: Date,
    account_path: [String],
    accounts: String,
    book: String,
    memo: String,
    _journal: {
      type: Schema.Types.ObjectId,
      ref: 'Medici_Journal'
    },
    timestamp: {
      type: Date,
      "default": Date.now
    },
    voided: {
      type: Boolean,
      "default": false
    },
    void_reason: String,
    _original_journal: Schema.Types.ObjectId
  });
  mongoose.model('Medici_Transaction', transactionSchema);
}

try {
  journalSchema = mongoose.model('Medici_Journal');
} catch (_error) {
  err = _error;
  journalSchema = new Schema({
    datetime: Date,
    memo: {
      type: String,
      "default": ''
    },
    _transactions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Medici_Transaction'
      }
    ],
    book: String,
    voided: {
      type: Boolean,
      "default": false
    },
    void_reason: String
  });
  journalSchema.methods["void"] = function(book, reason) {
    var deferred, trans_id, voidTransaction, voids, _i, _len, _ref,
      _this = this;
    deferred = Q.defer();
    if (this.voided === true) {
      deferred.reject(new Error('Journal already voided'));
    }
    this.voided = true;
    if (reason == null) {
      this.void_reason = '';
    } else {
      this.void_reason = reason;
    }
    voidTransaction = function(trans_id) {
      var d;
      d = Q.defer();
      mongoose.model('Medici_Transaction').findByIdAndUpdate(trans_id, {
        voided: true,
        void_reason: _this.void_reason
      }, function(err, trans) {
        if (err) {
          console.error('Failed to void transaction:', err);
          return d.reject(err);
        } else {
          return d.resolve(trans);
        }
      });
      return d.promise;
    };
    voids = [];
    _ref = this._transactions;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      trans_id = _ref[_i];
      voids.push(voidTransaction(trans_id));
    }
    Q.all(voids).then(function(transactions) {
      var key, meta, newMemo, trans, val, valid_fields, _j, _len1;
      if (_this.void_reason) {
        newMemo = _this.void_reason;
      } else {
        if (_this.memo.substr(0, 6) === '[VOID]') {
          newMemo = _this.memo.replace('[VOID]', '[UNVOID]');
        } else if (_this.memo.substr(0, 8) === '[UNVOID]') {
          newMemo = _this.memo.replace('[UNVOID]', '[REVOID]');
        } else if (_this.memo.substr(0, 8) === '[REVOID]') {
          newMemo = _this.memo.replace('[REVOID]', '[UNVOID]');
        } else {
          newMemo = '[VOID] ' + _this.memo;
        }
      }
      entry = book.entry(newMemo, null, _this._id);
      valid_fields = ['credit', 'debit', 'account_path', 'accounts', 'datetime', 'book', 'memo', 'timestamp', 'voided', 'void_reason', '_original_journal'];
      for (_j = 0, _len1 = transactions.length; _j < _len1; _j++) {
        trans = transactions[_j];
        trans = trans.toObject();
        meta = {};
        for (key in trans) {
          val = trans[key];
          if (key === '_id' || key === '_journal') {
            continue;
          }
          if (valid_fields.indexOf(key) === -1) {
            meta[key] = val;
          }
        }
        if (trans.credit) {
          entry.debit(trans.account_path, trans.credit, meta);
        }
        if (trans.debit) {
          entry.credit(trans.account_path, trans.debit, meta);
        }
      }
      return entry.commit().then(function(entry) {
        return deferred.resolve(entry);
      }, function(err) {
        return deferred.reject(err);
      });
    }, function(err) {
      return deferred.reject(err);
    });
    return deferred.promise;
  };
  mongoose.model('Medici_Journal', journalSchema);
}

module.exports = {
  book: book
};

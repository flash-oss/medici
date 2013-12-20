var Book, Q, entry, mongoose, _;

mongoose = require('mongoose');

entry = require('./entry');

_ = require('underscore');

Q = require('q');

module.exports = Book = (function() {
  function Book(name) {
    this.name = name;
  }

  Book.prototype.entry = function(memo, date, original_journal) {
    if (date == null) {
      date = null;
    }
    if (original_journal == null) {
      original_journal = null;
    }
    return entry.write(this, memo, date, original_journal);
  };

  Book.prototype.parseQuery = function(query) {
    var account, accounts, acct, end_date, i, key, keys, parsed, start_date, val, _i, _len;
    parsed = {};
    if ((account = query.account)) {
      accounts = account.split(':');
      for (i = _i = 0, _len = accounts.length; _i < _len; i = ++_i) {
        acct = accounts[i];
        parsed['account_path.' + i] = acct;
      }
      delete query.account;
    }
    if (query._journal) {
      parsed['_journal'] = query._journal;
    }
    if ((query.start_date != null) && (query.end_date != null)) {
      start_date = new Date(parseInt(query.start_date));
      end_date = new Date(parseInt(query.end_date));
      parsed['datetime'] = {
        $gte: start_date,
        $lte: end_date
      };
      delete query.start_date;
      delete query.end_date;
    } else if (query.start_date != null) {
      parsed['datetime'] = {
        $gte: new Date(parseInt(query.start_date))
      };
      delete query.start_date;
    } else if (query.end_date != null) {
      parsed['datetime'] = {
        $lte: new Date(parseInt(query.end_date))
      };
      delete query.end_date;
    }
    keys = _.keys(mongoose.model('Medici_Transaction').schema.paths);
    for (key in query) {
      val = query[key];
      if (keys.indexOf(key) >= 0) {
        if (key.substr(0, 1) === '_' && val instanceof String) {
          val = mongoose.Types.ObjectId(val);
        }
        parsed[key] = val;
      } else {
        if (key.indexOf('_id') > 0) {
          val = mongoose.Types.ObjectId(val);
        }
        parsed['meta.' + key] = val;
      }
    }
    parsed.book = this.name;
    return parsed;
  };

  Book.prototype.balance = function(query) {
    var deferred, group, match;
    deferred = Q.defer();
    query = this.parseQuery(query);
    match = {
      $match: query
    };
    group = {
      $group: {
        _id: '1',
        credit: {
          $sum: '$credit'
        },
        debit: {
          $sum: '$debit'
        }
      }
    };
    mongoose.model('Medici_Transaction').aggregate(match, group, function(err, result) {
      var total;
      if (err) {
        return deferred.reject(err);
      } else {
        result = result.shift();
        if (result == null) {
          return deferred.resolve(0);
        }
        total = result.credit - result.debit;
        return deferred.resolve(total);
      }
    });
    return deferred.promise;
  };

  Book.prototype.ledger = function(query, populate) {
    var deferred, pop, q, _i, _len;
    if (populate == null) {
      populate = null;
    }
    deferred = Q.defer();
    query = this.parseQuery(query);
    q = mongoose.model('Medici_Transaction').find(query);
    if (populate) {
      for (_i = 0, _len = populate.length; _i < _len; _i++) {
        pop = populate[_i];
        q.populate(pop);
      }
    }
    q.exec(function(err, results) {
      if (err) {
        return deferred.reject(err);
      } else {
        return deferred.resolve(results);
      }
    });
    return deferred.promise;
  };

  Book.prototype["void"] = function(journal_id, reason) {
    var deferred,
      _this = this;
    deferred = Q.defer();
    mongoose.model('Medici_Journal').findById(journal_id, function(err, journal) {
      if (err) {
        return deferred.reject(err);
      } else {
        return journal["void"](_this, reason).then(function() {
          return deferred.resolve();
        }, function(err) {
          return deferred.reject(err);
        });
      }
    });
    return deferred.promise;
  };

  Book.prototype.listAccounts = function() {
    var deferred;
    deferred = Q.defer();
    mongoose.model('Medici_Transaction').find({
      book: this.name
    }).distinct('accounts', function(err, results) {
      var acct, final, paths, prev, result, _i, _j, _len, _len1;
      if (err) {
        return deferred.reject(err);
      } else {
        final = [];
        for (_i = 0, _len = results.length; _i < _len; _i++) {
          result = results[_i];
          paths = result.split(':');
          prev = [];
          for (_j = 0, _len1 = paths.length; _j < _len1; _j++) {
            acct = paths[_j];
            prev.push(acct);
            final.push(prev.join(':'));
          }
        }
        return deferred.resolve(_.uniq(final));
      }
    });
    return deferred.promise;
  };

  return Book;

})();

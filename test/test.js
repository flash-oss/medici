var medici, moment, mongoose, util;

mongoose = require('mongoose');

mongoose.connect('mongodb://localhost/medici_test');

mongoose.set('debug', true);

util = require('util');

medici = require('../index');

require('should');

moment = require('moment');

describe('Medici', function() {
  this.timeout(15000);
  before(function(done) {
    mongoose.connection.collections.medici_transactions.drop();
    mongoose.connection.collections.medici_journals.drop();
    return done();
  });
  it('Should let you create a basic transaction', function(done) {
    var book,
      _this = this;
    book = new medici.book('MyBook');
    return book.entry('Test Entry').debit('Assets:Receivable', 500).credit('Income:Rent', 500).commit().then(function(journal) {
      journal.memo.should.equal('Test Entry');
      journal._transactions.length.should.equal(2);
      _this.journal = journal;
      return book.entry('Test Entry 2', moment().subtract('days', 3).toDate()).debit('Assets:Receivable', 700).credit('Income:Rent', 700).commit().then(function(journal) {
        _this.journal2 = journal;
        journal.book.should.equal('MyBook');
        journal.memo.should.equal('Test Entry 2');
        journal._transactions.length.should.equal(2);
        return done();
      });
    });
  });
  it('Should have updated the balance for assets and income and accurately give balance for subaccounts', function(done) {
    var book;
    console.log('Starting Balance');
    book = new medici.book('MyBook');
    console.log('Getting balance...');
    return book.balance({
      account: 'Assets'
    }).then(function(data) {
      var bal, notes;
      console.log('got data');
      bal = data.balance;
      notes = data.notes;
      notes.should.equal(2);
      bal.should.equal(-1200);
      console.log('Got to here!');
      return book.balance({
        account: 'Assets:Receivable'
      }).then(function(data) {
        bal = data.balance;
        notes = data.notes;
        bal.should.equal(-1200);
        notes.should.equal(2);
        return book.balance({
          account: 'Assets:Other'
        }).then(function(data) {
          console.log('Got to here!');
          bal = data.balance;
          notes = data.notes;
          console.log(data);
          bal.should.equal(0);
          notes.should.equal(0);
          return done();
        });
      });
    });
  });
  it('should return full ledger', function(done) {
    var book;
    book = new medici.book('MyBook');
    return book.ledger({
      account: 'Assets'
    }).then(function(res) {
      res.results.length.should.equal(2);
      return done();
    });
  });
  it('should allow you to void a journal entry', function(done) {
    var book;
    book = new medici.book('MyBook');
    return book["void"](this.journal._id, 'Messed up').then(function() {
      return book.balance({
        account: 'Assets'
      }).then(function(data) {
        data.balance.should.equal(-700);
        return done();
      });
    });
  });
  it('should list all accounts', function(done) {
    var book;
    book = new medici.book('MyBook');
    return book.listAccounts().then(function(accounts) {
      accounts.indexOf('Assets').should.be.greaterThan(-1);
      accounts.indexOf('Assets:Receivable').should.be.greaterThan(-1);
      accounts.indexOf('Income').should.be.greaterThan(-1);
      accounts.indexOf('Income:Rent').should.be.greaterThan(-1);
      return done();
    });
  });
  it('should return ledger with array of accounts', function(done) {
    var book;
    book = new medici.book('MyBook');
    return book.ledger({
      account: ['Assets', 'Income']
    }).then(function(response) {
      var res, _i, _len, _ref;
      response.results.length.should.equal(6);
      _ref = response.results;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        res = _ref[_i];
        ((res.account_path.indexOf('Assets') >= 0) || (res.account_path.indexOf('Income') >= 0)).should.equal(true);
      }
      return done();
    });
  });
  it('should give you a paginated ledger when requested', function(done) {
    var book;
    book = new medici.book('MyBook');
    return book.ledger({
      account: ['Assets', 'Income'],
      perPage: 2,
      page: 3
    }).then(function(response) {
      response.results.length.should.equal(2);
      response.total.should.equal(6);
      response.results[0].memo.should.equal('Test Entry 2');
      response.results[1].memo.should.equal('Test Entry 2');
      return done();
    });
  });
  it('should give you the balance by page', function(done) {
    var book,
      _this = this;
    book = new medici.book('MyBook');
    return book.balance({
      account: 'Assets',
      perPage: 1,
      page: 1
    }).then(function(data) {
      data.balance.should.equal(-700);
      return book.balance({
        account: 'Assets',
        perPage: 1,
        page: 2
      }).then(function(data) {
        data.balance.should.equal(-1200);
        return book.balance({
          account: 'Assets',
          perPage: 1,
          page: 3
        }).then(function(data) {
          data.balance.should.equal(-700);
          return done();
        });
      });
    });
  });
  return describe('approved/pending transactions', function() {
    it('should not include pending transactions in balance', function(done) {
      var book,
        _this = this;
      book = new medici.book('MyBook');
      return book.entry('Test Entry').debit('Foo', 500).credit('Bar', 500).setApproved(false).commit().then(function(journal) {
        _this.pendingJournal = journal;
        return book.balance({
          account: 'Foo'
        }).then(function(data) {
          data.balance.should.equal(0);
          return done();
        });
      });
    });
    it('should not include pending transactions in ledger', function(done) {
      var book;
      book = new medici.book('MyBook');
      return book.ledger({
        account: ['Foo']
      }).then(function(response) {
        response.results.length.should.equal(0);
        return done();
      });
    });
    return it('should set all transactions to approved when approving the journal', function(done) {
      var book;
      book = new medici.book('MyBook');
      this.pendingJournal.approved = true;
      return this.pendingJournal.save(function() {
        var _this = this;
        return book.balance({
          account: 'Bar'
        }).then(function(data) {
          data.balance.should.equal(500);
          return done();
        });
      });
    });
  });
});

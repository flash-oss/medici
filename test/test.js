var medici, moment, mongoose;

mongoose = require('mongoose');

mongoose.connect('mongodb://localhost/medici_test');

mongoose.set('debug', true);

medici = require('../index');

require('should');

moment = require('moment');

describe('Medici', function() {
  this.timeout(3000);
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
        journal.memo.should.equal('Test Entry 2');
        journal._transactions.length.should.equal(2);
        return done();
      });
    });
  });
  it('Should have updated the balance for assets and income and accurately give balance for subaccounts', function(done) {
    var book;
    book = new medici.book('MyBook');
    return book.balance({
      account: 'Assets'
    }).then(function(bal) {
      console.log('Balance:', bal);
      bal.should.equal(-1200);
      return book.balance({
        account: 'Assets:Receivable'
      }).then(function(bal) {
        console.log('Checked balance of accts receivable, got to here');
        bal.should.equal(-1200);
        return book.balance({
          account: 'Assets:Other'
        }).then(function(bal) {
          bal.should.equal(0);
          return done();
        });
      });
    }, function(err) {
      return console.log(err.stack);
    });
  });
  it('should return full ledger', function(done) {
    var book;
    book = new medici.book('MyBook');
    return book.ledger({
      account: 'Assets'
    }).then(function(results) {
      results.length.should.equal(2);
      return done();
    });
  });
  it('should allow you to void a journal entry', function(done) {
    var book;
    book = new medici.book('MyBook');
    return book["void"](this.journal._id, 'Messed up').then(function() {
      return book.balance({
        account: 'Assets'
      }).then(function(bal) {
        bal.should.equal(-700);
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
    }).then(function(results) {
      var res, _i, _len;
      results.length.should.equal(6);
      for (_i = 0, _len = results.length; _i < _len; _i++) {
        res = results[_i];
        ((res.account_path.indexOf('Assets') >= 0) || (res.account_path.indexOf('Income') >= 0)).should.equal(true);
      }
      return done();
    });
  });
  return it('should give you a paginated ledger when requested', function(done) {
    var book;
    book = new medici.book('MyBook');
    return book.ledger({
      account: ['Assets', 'Income'],
      perPage: 2,
      page: 3
    }).then(function(results) {
      console.log('Got to here', results);
      results.length.should.equal(2);
      results[0].memo.should.equal('Test Entry 2');
      results[1].memo.should.equal('Test Entry 2');
      return done();
    });
  });
});

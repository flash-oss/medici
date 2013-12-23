var medici, mongoose;

mongoose = require('mongoose');

mongoose.connect('mongodb://localhost/medici_test');

medici = require('../index');

require('should');

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
      return done();
    });
  });
  it('Should have updated the balance for assets and income and accurately give balance for subaccounts', function(done) {
    var book;
    book = new medici.book('MyBook');
    return book.balance({
      account: 'Assets'
    }).then(function(bal) {
      bal.should.equal(-500);
      return book.balance({
        account: 'Assets:Receivable'
      }).then(function(bal) {
        bal.should.equal(-500);
        return book.balance({
          account: 'Assets:Other'
        }).then(function(bal) {
          bal.should.equal(0);
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
    }).then(function(results) {
      results.length.should.equal(1);
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
        bal.should.equal(0);
        return done();
      });
    });
  });
  return it('should list all accounts', function(done) {
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
});

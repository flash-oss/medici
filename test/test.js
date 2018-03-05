require('./_setup');
const {book: Book} = require('../');
require('should');

describe('Medici', function () {
  it('Should let you create a basic transaction', function (done) {
    const book = new Book('MyBook');
    book
    .entry('Test Entry')
    .debit('Assets:Receivable', 500, {clientId: '12345'})
    .credit('Income:Rent', 500)
    .commit()
    .then(journal => {
      journal.memo.should.equal('Test Entry');
      journal._transactions.length.should.equal(2);
      this.journal = journal;
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      return book
      .entry('Test Entry 2', threeDaysAgo)
      .debit('Assets:Receivable', 700)
      .credit('Income:Rent', 700)
      .commit()
      .then(journal => {
        this.journal2 = journal;
        journal.book.should.equal('MyBook');
        journal.memo.should.equal('Test Entry 2');
        journal._transactions.length.should.equal(2);
        done();
      });
    })
    .catch(done);
  });

  it('Should deal with JavaScript rounding weirdness', function (done) {
    const book = new Book('MyBook');
    book
    .entry('Rounding Test')
    .credit('A:B', 1005)
    .debit('A:B', 994.95)
    .debit('A:B', 10.05)
    .commit()
    .then(journal => book.balance({account: 'A:B'}))
    .then(({balance}) => {
      balance.should.equal(0);
    })
    .then(() => done())
    .catch(done);
  });

  it('should throw INVALID_JOURNAL if an entry total is !=0 and <0', function (done) {
    const book = new Book('MyBook');
    const entry = book.entry("This is a test entry");
    entry.debit("Assets:Cash", 99.9, {});
    entry.credit("Income", 99.8, {});
    entry.commit().then(() => done(new Error('Must have been rejected'))).catch(() => done());
  });

  it('should throw INVALID_JOURNAL if an entry total is !=0 and >0', function (done) {
    const book = new Book('MyBook');
    const entry = book.entry("This is a test entry");
    entry.debit("Assets:Cash", 99.8, {});
    entry.credit("Income", 99.9, {});
    entry.commit().then(() => done(new Error('Must have been rejected'))).catch(() => done());
  });

  it('Should have updated the balance for assets and income and accurately give balance for subaccounts', function (done) {
    const book = new Book('MyBook');
    book
    .balance({
      account: 'Assets'
    })
    .then(function (data) {
      let bal = data.balance;
      let {notes} = data;
      notes.should.equal(2);
      bal.should.equal(-1200);

      return book.balance({account: 'Assets:Receivable'})
      .then(function (data) {
        bal = data.balance;
        ({notes} = data);
        bal.should.equal(-1200);
        notes.should.equal(2);

        return book
        .balance({
          account: 'Assets:Other'
        })
        .then(function (data) {
          bal = data.balance;
          ({notes} = data);

          bal.should.equal(0);
          notes.should.equal(0);

          done();
        });
      });
    })
    .catch(done);
  });

  it('should return full ledger', function (done) {
    const book = new Book('MyBook');
    book
    .ledger({
      account: 'Assets'
    })
    .then(function (res) {
      res.results.length.should.equal(2);
      done();
    })
    .catch(done);
  });

  it('should allow you to void a journal entry', function (done) {
    const book = new Book('MyBook');
    book.balance({
      account: 'Assets',
      clientId: '12345'
    }).then(function (data) {
      data.balance.should.equal(-500);
    })
    .then(() =>
      book.void(this.journal._id, 'Messed up')
    )
    .then(() =>
      book
      .balance({
        account: 'Assets'
      })
      .then((data) => {
        data.balance.should.equal(-700);
      })
    )
    .then(() =>
      book.balance({
        account: 'Assets',
        clientId: '12345'
      })
      .then((data) => {
        data.balance.should.equal(0);
        done();
      })
    )
    .catch(done);
  });

  it('should list all accounts', function (done) {
    const book = new Book('MyBook');
    book
    .listAccounts()
    .then(function (accounts) {
      accounts.indexOf('Assets').should.be.greaterThan(-1);
      accounts.indexOf('Assets:Receivable').should.be.greaterThan(-1);
      accounts.indexOf('Income').should.be.greaterThan(-1);
      accounts.indexOf('Income:Rent').should.be.greaterThan(-1);
      done();
    })
    .catch(done);
  });

  it('should return ledger with array of accounts', function (done) {
    const book = new Book('MyBook');
    book
    .ledger({
      account: ['Assets', 'Income']
    })
    .then(function (response) {
      response.results.length.should.equal(6);
      for (let res of response.results) {
        (res.account_path.indexOf('Assets') >= 0 ||
          res.account_path.indexOf('Income') >= 0).should
        .equal(true);
      }
      done();
    })
    .catch(done);
  });

  it('should give you a paginated ledger when requested', function (done) {
    const book = new Book('MyBook');
    book
    .ledger({
      account: ['Assets', 'Income'],
      perPage: 2,
      page: 3
    })
    .then(function (response) {
      response.results.length.should.equal(2);
      response.total.should.equal(6);
      // verify correct sorting
      response.results[0].memo.should.equal('Test Entry 2');
      response.results[1].memo.should.equal('Test Entry 2');
      done();
    })
    .catch(done);
  });

  it('should give you the balance by page', function (done) {
    const book = new Book('MyBook');
    book
    .balance({
      account: 'Assets',
      perPage: 1,
      page: 1
    })
    .then(data => {
      data.balance.should.equal(-700);

      return book
      .balance({
        account: 'Assets',
        perPage: 1,
        page: 2
      })
      .then(data => {
        data.balance.should.equal(-1200);

        return book
        .balance({
          account: 'Assets',
          perPage: 1,
          page: 3
        })
        .then(data => {
          data.balance.should.equal(-700);
          done();
        });
      });
    })
    .catch(done);
  });

  describe('approved/pending transactions', function () {
    it('should not include pending transactions in balance', function (done) {
      const book = new Book('MyBook');

      book
      .entry('Test Entry')
      .debit('Foo', 500)
      .credit('Bar', 500)
      .setApproved(false)
      .commit()
      .then(journal => {
        this.pendingJournal = journal;
        // Balance should still be 0 since they're not approved
        return book
        .balance({
          account: 'Foo'
        })
        .then(data => {
          data.balance.should.equal(0);
          done();
        });
      })
      .catch(done);
    });

    it('should not include pending transactions in ledger', function (done) {
      const book = new Book('MyBook');
      book
      .ledger({
        account: ['Foo']
      })
      .then(function (response) {
        response.results.length.should.equal(0);
        done();
      })
      .catch(done);
    });

    it('should set all transactions to approved when approving the journal', function (done) {
      const book = new Book('MyBook');
      this.pendingJournal.approved = true;
      this.pendingJournal.save(() =>
        book
        .balance({
          account: 'Bar'
        })
        .then(data => {
          data.balance.should.equal(500);
          done();
        })
        .catch(done)
      );
    });
  });
});

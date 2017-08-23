/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost/medici_test');
mongoose.set('debug', true);
const medici = require('../');
require('should');
const moment = require('moment');
describe('Medici', function() {
	this.timeout(15000);
	before(function(done) {
		mongoose.connection.collections.medici_transactions.drop();
		mongoose.connection.collections.medici_journals.drop();
		return done();
	});

	it('Should let you create a basic transaction', function(done) {
		const book = new medici.book('MyBook');
		book.entry('Test Entry').debit('Assets:Receivable', 500).credit('Income:Rent', 500).commit().then(journal => {
			journal.memo.should.equal('Test Entry');
			journal._transactions.length.should.equal(2);
			this.journal = journal;
			return book.entry('Test Entry 2', moment().subtract('days', 3).toDate()).debit('Assets:Receivable', 700).credit('Income:Rent', 700).commit().then(journal => {
				this.journal2 = journal;
				journal.book.should.equal('MyBook');
				journal.memo.should.equal('Test Entry 2');
				journal._transactions.length.should.equal(2);
				return done();
			});
		}).catch(done);
	});

	it('Should have updated the balance for assets and income and accurately give balance for subaccounts', function(done) {

		console.log('Starting Balance');
		const book = new medici.book('MyBook');
		console.log('Getting balance...');
		book.balance({
			account:'Assets'})
		.then(function(data) {
			console.log('got data');
			let bal = data.balance;
			let { notes } = data;
			notes.should.equal(2);
			bal.should.equal(-1200);

			console.log('Got to here!');
			return book.balance({
				account:'Assets:Receivable'})
			.then(function(data) {
				bal = data.balance;
				({ notes } = data);
				bal.should.equal(-1200);
				notes.should.equal(2);

				return book.balance({
					account:'Assets:Other'})
				.then(function(data) {
					console.log('Got to here!');
					bal = data.balance;
					({ notes } = data);

					console.log(data);
					bal.should.equal(0);
					notes.should.equal(0);

					return done();
				});
			});
		}).catch(done);
	});

	it('should return full ledger', function(done) {
		const book = new medici.book('MyBook');
		book.ledger({
			account:'Assets'})
		.then(function(res) {
			res.results.length.should.equal(2);
			return done();
		})
		.catch(done);
	});


	it('should allow you to void a journal entry', function(done) {
		const book = new medici.book('MyBook');
		book.void(this.journal._id, 'Messed up').then(() =>
			book.balance({
				account:'Assets'})
			.then(function(data) {
				data.balance.should.equal(-700);
				return done();
			})
		)
        .catch(done);
	});

	it('should list all accounts', function(done) {
		const book = new medici.book('MyBook');
		book.listAccounts().then(function(accounts) {
			accounts.indexOf('Assets').should.be.greaterThan(-1);
			accounts.indexOf('Assets:Receivable').should.be.greaterThan(-1);
			accounts.indexOf('Income').should.be.greaterThan(-1);
			accounts.indexOf('Income:Rent').should.be.greaterThan(-1);
			return done();
		})
        .catch(done);
	});

	it('should return ledger with array of accounts', function(done) {
		const book = new medici.book('MyBook');
		book.ledger({
			account:['Assets','Income']})
		.then(function(response) {
			response.results.length.should.equal(6);
			for (let res of Array.from(response.results)) {
				((res.account_path.indexOf('Assets') >= 0) || (res.account_path.indexOf('Income') >= 0)).should.equal(true);
			}
			return done();
		})
        .catch(done);
	});

	it('should give you a paginated ledger when requested', function(done) {
		const book = new medici.book('MyBook');
		book.ledger({
			account:['Assets','Income'],
			perPage:2,
			page:3}).then(function(response) {
			response.results.length.should.equal(2);
			response.total.should.equal(6);
			// verify correct sorting
			response.results[0].memo.should.equal('Test Entry 2');
			response.results[1].memo.should.equal('Test Entry 2');
			return done();
		})
        .catch(done);
	});

	it('should give you the balance by page', function(done) {

		
		const book = new medici.book('MyBook');
		book.balance({
			account:'Assets',
			perPage:1,
			page:1}).then(data => {
			data.balance.should.equal(-700);

			return book.balance({
				account:'Assets',
				perPage:1,
				page:2}).then(data => {
				data.balance.should.equal(-1200);

				return book.balance({
					account:'Assets',
					perPage:1,
					page:3}).then(data => {
					data.balance.should.equal(-700);
					return done();
				});
			});
		})
        .catch(done);
	});

	describe('approved/pending transactions',  function() {
		it('should not include pending transactions in balance', function(done) {
			const book = new medici.book('MyBook');
			
			book.entry('Test Entry').debit('Foo', 500).credit('Bar', 500).setApproved(false).commit().then(journal => {
				this.pendingJournal = journal;
				// Balance should still be 0 since they're not approved
				return book.balance({
					account:'Foo'})
				.then(data => {
					data.balance.should.equal(0);
					return done();
				});
			})
            .catch(done);
		});
		it('should not include pending transactions in ledger', function(done) {
			const book = new medici.book('MyBook');
			book.ledger({
				account:['Foo']})
			.then(function(response) {
				response.results.length.should.equal(0);
				return done();
			})
            .catch(done);
		});
		it('should set all transactions to approved when approving the journal', function(done) {
			const book = new medici.book('MyBook');
			this.pendingJournal.approved = true;
			this.pendingJournal.save(() =>
				book.balance({
					account:'Bar'})
				.then(data => {
					data.balance.should.equal(500);
					return done();
				})
                .catch(done)
			);
		});
	});
});

			
		



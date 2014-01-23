
mongoose = require 'mongoose'

mongoose.connect('mongodb://localhost/medici_test')
mongoose.set('debug', true)

medici = require '../index'
require 'should'
moment = require 'moment'
describe 'Medici', ->
	@timeout(15000)
	before (done) ->
		mongoose.connection.collections.medici_transactions.drop()
		mongoose.connection.collections.medici_journals.drop()
		done()

	it 'Should let you create a basic transaction', (done) ->
		book = new medici.book('MyBook')
		book.entry('Test Entry').debit('Assets:Receivable', 500).credit('Income:Rent', 500).commit().then (journal) =>
			journal.memo.should.equal('Test Entry')
			journal._transactions.length.should.equal(2)
			@journal = journal
			book.entry('Test Entry 2', moment().subtract('days', 3).toDate()).debit('Assets:Receivable', 700).credit('Income:Rent', 700).commit().then (journal) =>
				journal.memo.should.equal('Test Entry 2')
				journal._transactions.length.should.equal(2)
				done()

	it 'Should have updated the balance for assets and income and accurately give balance for subaccounts', (done) ->
		book = new medici.book('MyBook')
		book.balance
			account:'Assets'
		.then (bal) ->
			console.log 'Balance:', bal
			bal.should.equal(-1200)

			book.balance
				account:'Assets:Receivable'
			.then (bal) ->
				console.log 'Checked balance of accts receivable, got to here'
				bal.should.equal(-1200)

				book.balance
					account:'Assets:Other'
				.then (bal) ->
					bal.should.equal(0)

					done()
		, (err) ->
			console.log err.stack

	it 'should return full ledger', (done) ->
		book = new medici.book('MyBook')
		book.ledger
			account:'Assets'
		.then (results) ->
			results.length.should.equal(2)
			done()

	it 'should allow you to void a journal entry', (done) ->
		book = new medici.book('MyBook')
		book.void(@journal._id, 'Messed up').then ->
			book.balance
				account:'Assets'
			.then (bal) ->
				bal.should.equal(-700)
				done()

	it 'should list all accounts', (done) ->
		book = new medici.book('MyBook')
		book.listAccounts().then (accounts) ->
			accounts.indexOf('Assets').should.be.greaterThan(-1)
			accounts.indexOf('Assets:Receivable').should.be.greaterThan(-1)
			accounts.indexOf('Income').should.be.greaterThan(-1)
			accounts.indexOf('Income:Rent').should.be.greaterThan(-1)
			done()

	it 'should return ledger with array of accounts', (done) ->
		book = new medici.book('MyBook')
		book.ledger
			account:['Assets','Income']
		.then (results) ->
			results.length.should.equal(6)
			for res in results
				((res.account_path.indexOf('Assets') >= 0) or (res.account_path.indexOf('Income') >= 0)).should.equal(true)
			done()

	it 'should give you a paginated ledger when requested', (done) ->
		book = new medici.book('MyBook')
		book.ledger
			account:['Assets','Income']
			perPage:2
			page:3
		.then (results) ->
			console.log 'Got to here', results
			results.length.should.equal(2)

			# verify correct sorting
			results[0].memo.should.equal('Test Entry 2')
			results[1].memo.should.equal('Test Entry 2')
			done()

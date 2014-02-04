
mongoose = require 'mongoose'

mongoose.connect('mongodb://localhost/medici_test')
mongoose.set('debug', true)
util = require 'util'
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
				@journal2 = journal
				journal.book.should.equal('MyBook')
				journal.memo.should.equal('Test Entry 2')
				journal._transactions.length.should.equal(2)
				done()

	it 'Should have updated the balance for assets and income and accurately give balance for subaccounts', (done) ->

		console.log 'Starting Balance'
		book = new medici.book('MyBook')
		book.balance
			account:'Assets'
		.then (data) ->
			bal = data.balance
			notes = data.notes
			notes.should.equal(2)
			bal.should.equal(-1200)

			console.log 'Got to here!'
			book.balance
				account:'Assets:Receivable'
			.then (data) ->
				bal = data.balance
				notes = data.notes
				bal.should.equal(-1200)
				notes.should.equal(2)

				book.balance
					account:'Assets:Other'
				.then (data) ->
					console.log 'Got to here!'
					bal = data.balance
					notes = data.notes

					console.log data
					bal.should.equal(0)
					notes.should.equal(0)

					done()

	it 'should return full ledger', (done) ->
		book = new medici.book('MyBook')
		book.ledger
			account:'Assets'
		.then (res) ->
			res.results.length.should.equal(2)
			done()


	it 'should allow you to void a journal entry', (done) ->
		book = new medici.book('MyBook')
		book.void(@journal._id, 'Messed up').then ->
			book.balance
				account:'Assets'
			.then (data) ->
				data.balance.should.equal(-700)
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
		.then (response) ->
			response.results.length.should.equal(6)
			for res in response.results
				((res.account_path.indexOf('Assets') >= 0) or (res.account_path.indexOf('Income') >= 0)).should.equal(true)
			done()

	it 'should give you a paginated ledger when requested', (done) ->
		book = new medici.book('MyBook')
		book.ledger
			account:['Assets','Income']
			perPage:2
			page:3
		.then (response) ->
			response.results.length.should.equal(2)
			response.total.should.equal(6)
			# verify correct sorting
			response.results[0].memo.should.equal('Test Entry 2')
			response.results[1].memo.should.equal('Test Entry 2')
			done()

	it 'should give you the balance by page', (done) ->

		
		book = new medici.book('MyBook')
		book.balance
			account:'Assets'
			perPage:1
			page:1
		.then (data) =>
			data.balance.should.equal(-700)

			book.balance
				account:'Assets'
				perPage:1
				page:2
			.then (data) =>
				data.balance.should.equal(-1200)

				book.balance
					account:'Assets'
					perPage:1
					page:3
				.then (data) =>
					data.balance.should.equal(-700)
					done()
			
		



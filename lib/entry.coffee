_ = require('underscore')
mongoose = require('mongoose')
Q = require('q')
module.exports = class Entry
	@write:(book, memo, date=null,original_journal=null) ->
		return new @(book, memo, date, original_journal)
	constructor:(book, memo, date,original_journal) ->
		@book = book
		journalClass = @book.journalClass
		@journal = new journalClass()
		@journal.memo = memo

		if original_journal
			@journal._original_journal = original_journal

		if !date
			date = new Date()
		@journal.datetime = date
		@transactions = []
		@transactionModels = []
	credit:(account_path, amount, extra=null) ->
		amount = parseFloat(amount)
		if typeof account_path is 'string'
			account_path = account_path.split(':')
		
		if account_path.length > 3
			throw "Account path is too deep (maximum 3)"

		transaction =
			account_path:account_path
			accounts:account_path.join(':')
			credit:amount
			debit:0.0
			book:@book.name
			memo:@journal.memo
			_journal:@journal._id
			datetime:@journal.datetime
			_original_journal:@journal._original_journal
			timestamp:new Date()

		# Loop through the meta and see if there are valid keys on the schema
		keys = _.keys(@book.transactionClass.schema.paths)
		meta = {}
		for key,val of extra
			if keys.indexOf(key) >= 0
				transaction[key] = val
			else
				meta[key] = val
		transaction.meta = meta
		@transactions.push(transaction)


		return @
	debit:(account_path, amount, extra=null) ->
		amount = parseFloat(amount)
		if typeof account_path is 'string'
			account_path = account_path.split(':')
		if account_path.length > 3
			throw "Account path is too deep (maximum 3)"
			
		transaction =
			account_path:account_path
			accounts:account_path.join(':')
			credit:0.0
			debit:amount
			_journal:@journal._id
			book:@book.name
			memo:@journal.memo
			datetime:@journal.datetime
			_original_journal:@journal._original_journal
		
		# Loop through the meta and see if there are valid keys on the schema
		keys = _.keys(@book.transactionClass.schema.paths)
		meta = {}
		for key,val of extra
			if keys.indexOf(key) >= 0
				transaction[key] = val
			else
				meta[key] = val

		@transactions.push(transaction)
		transaction.meta = meta
		
		return @


	saveTransaction:(transaction) ->
		d = Q.defer()

		modelClass = @book.transactionClass

		model = new modelClass(transaction)
		@journal._transactions.push(model._id)
		model.save (err, res) ->
			if err
				d.reject(err)
			else
				d.resolve(res)
		return d.promise
	commit: (success) ->
		deferred = Q.defer()


		@transactionsSaved = 0
		total = 0.0
		for transaction in @transactions
			total += transaction.credit
			total -= transaction.debit
		if total > 0 or total < 0
			err = new Error("INVALID_JOURNAL")
			err.code = 400
			console.error 'Journal is invalid. Total is:', total
			deferred.reject(err)
		else
			saves = []
			for trans in @transactions
				saves.push(@saveTransaction(trans))

			Q.all(saves).then =>
				@journal.save (err, result) =>
					if err
						@book.transactionClass.remove 
							_journal:@journal._id
						deferred.reject(new Error('Failure to save journal'))
					else
						deferred.resolve(@journal)
						if success? then success(@journal)
			, (err) ->
				deferred.reject(err)


		return deferred.promise

		
		
_ = require('underscore')
mongoose = require('mongoose')
Q = require('q')
module.exports = class Entry
	@write:(book, memo, date=null,original_journal=null) ->
		return new @(book, memo, date, original_journal)
	constructor:(book, memo, date,original_journal) ->
		console.log 'constructed entry with original journal:', original_journal
		@book = book
		journalClass = mongoose.model('Medici_Journal')
		@journal = new journalClass()
		@journal.memo = memo

		if original_journal
			console.log 'setting journal original to', original_journal
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
		keys = _.keys(mongoose.model('Medici_Transaction').schema.paths)
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
		keys = _.keys(mongoose.model('Medici_Transaction').schema.paths)
		meta = {}
		for key,val of extra
			if keys.indexOf(key) >= 0
				console.log key, 'is part of schema, setting to', val
				transaction[key] = val
			else
				meta[key] = val

		@transactions.push(transaction)
		transaction.meta = meta
		
		return @


	saveTransaction:(transaction) ->
		d = Q.defer()

		modelClass = mongoose.model('Medici_Transaction')

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

		console.log 'committing in commit method...'
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
				console.log 'saved journal...'
				@journal.save (err, result) =>
					if err
						mongoose.model('Medici_Transaction').remove 
							_journal:@journal._id
						deferred.reject(new Error('Failure to save journal'))
					else
						deferred.resolve(@journal)
						if success? then success(@journal)
			, (err) ->
				console.log 'could not save all transactions', err
				deferred.reject(err)


		return deferred.promise

		
		
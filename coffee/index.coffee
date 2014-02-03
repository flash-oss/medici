entry = require('./lib/entry')
book = require('./lib/book')
mongoose = require('mongoose')
Schema = mongoose.Schema
Q = require('q')
_ = require('underscore')

# This lets you register your own schema before including Medici. Useful if you want to store additional information
# along side each transaction
try 
	mongoose.model('Medici_Transaction')
catch err
	transactionSchema = new Schema
		credit:Number
		debit:Number
		meta:Schema.Types.Mixed
		datetime:Date
		account_path:[String]
		accounts:String
		book:String
		memo:String
		_journal:
			type:Schema.Types.ObjectId
			ref:'Medici_Journal'
		timestamp:
			type:Date
			default:Date.now
		voided:
			type:Boolean
			default:false
		void_reason:String
		# The journal that this is voiding, if any
		_original_journal:Schema.Types.ObjectId
		approved:
			type:Boolean
			default:true
	mongoose.model('Medici_Transaction', transactionSchema)

# We really only need journals so we can group by journal entry and void all transactions. Datetime
# and memo also go to the transaction for easy searching without having to populate the journal
# model each time.
try 
	journalSchema = mongoose.model('Medici_Journal')
catch err
	journalSchema = new Schema
		datetime:Date
		memo:
			type:String
			default:''
		_transactions:[
				type:Schema.Types.ObjectId
				ref:'Medici_Transaction'
		]
		book:String
		voided:
			type:Boolean
			default:false
		void_reason:String
		approved:
			type:Boolean
			default:true



	journalSchema.methods.void = (book, reason) ->
		deferred = Q.defer()
		if @voided is true
			deferred.reject(new Error('Journal already voided'))
		# Set this to void with reason and also set all associated transactions
		@voided = true
		if !reason?
			@void_reason = ''
		else
			@void_reason = reason

		voidTransaction = (trans_id) =>
			d = Q.defer()
			mongoose.model('Medici_Transaction').findByIdAndUpdate trans_id,
				voided:true
				void_reason:@void_reason
			, (err, trans) ->
				if err
					console.error 'Failed to void transaction:', err
					d.reject(err)
				else
					d.resolve(trans)
			return d.promise
			

		voids = []
		for trans_id in @_transactions
			voids.push(voidTransaction(trans_id))

		Q.all(voids).then (transactions) =>
			if @void_reason
				newMemo = @void_reason
			else
				# It's either VOID, UNVOID, or REVOID
				if @memo.substr(0,6) is '[VOID]'
					newMemo = @memo.replace('[VOID]', '[UNVOID]')
				else if @memo.substr(0,8) is '[UNVOID]'
					newMemo = @memo.replace('[UNVOID]', '[REVOID]')
				else if @memo.substr(0,8) is '[REVOID]'
					newMemo = @memo.replace('[REVOID]', '[UNVOID]')
				else
					newMemo = '[VOID] ' + @memo
			# Ok now create an equal and opposite journal
			entry = book.entry(newMemo, null, @_id)
			valid_fields = ['credit','debit','account_path','accounts','datetime','book','memo','timestamp','voided','void_reason','_original_journal']

			for trans in transactions
				trans = trans.toObject()
				meta = {}
				for key,val of trans
					if key is '_id' or key is '_journal'
						continue
					if valid_fields.indexOf(key) is -1
						meta[key] = val
				if trans.credit
					entry.debit(trans.account_path, trans.credit, meta)
				if trans.debit
					entry.credit(trans.account_path, trans.debit, meta)

			entry.commit().then (entry) ->
				deferred.resolve(entry)
			, (err) ->
				deferred.reject(err)
		, (err) ->
			deferred.reject(err)

		return deferred.promise

	journalSchema.pre 'save', (next)->
		if @isModified('approved') and @approved is true
			promises = []
			mongoose.model('Medici_Transaction').find
				_journal:@_id
			, (err, transactions) ->
				for transaction in transactions
					transaction.approved = true
					promises.push(transaction.save())

				Q.all(promises).then ->
					next()
		else
			next()
	mongoose.model('Medici_Journal', journalSchema)

	

module.exports = 
	book:book
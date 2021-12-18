# medici

<div align="center">

[![Build Status](https://github.com/flash-oss/medici/actions/workflows/ci.yml/badge.svg)](https://github.com/flash-oss/medici/actions)
[![Known Vulnerabilities](https://snyk.io/test/github/flash-oss/medici/badge.svg)](https://snyk.io/test/github/flash-oss/medici)
[![Security Responsible Disclosure](https://img.shields.io/badge/Security-Responsible%20Disclosure-yellow.svg)](https://github.com/nodejs/security-wg/blob/HEAD/processes/responsible_disclosure_template.md)
[![NPM version](https://img.shields.io/npm/v/medici.svg?style=flat)](https://www.npmjs.com/package/medici)
[![NPM downloads](https://img.shields.io/npm/dm/medici.svg?style=flat)](https://www.npmjs.com/package/medici)

</div>

Double-entry accounting system for nodejs + mongoose

```bash
npm i medici
```

## Basics

To use Medici you will need a working knowledge of JavaScript, Node.js, and Mongoose.

Medici divides itself into "books", each of which store _journal entries_ and their child _transactions_. The cardinal rule of double-entry accounting is that "for every debit entry, there must be a corresponding credit entry" which means "everything must balance out to zero", and that rule is applied to every journal entry written to the book. If the transactions for a journal entry do not balance out to zero, the system will throw a new error with the message `INVALID JOURNAL`.

Books simply represent the physical book in which you would record your transactions - on a technical level, the "book" attribute simply is added as a key-value pair to both the `Medici_Transactions` and `Medici_Journals` collection to allow you to have multiple books if you want to.

Each transaction in Medici is for one account. Additionally, sub accounts can be created, and are separated by a colon. Transactions to the Assets:Cash account will appear in a query for transactions in the Assets account, but will not appear in a query for transactions in the Assets:Property account. This allows you to query, for example, all expenses, or just "office overhead" expenses (Expenses:Office Overhead).

In theory, the account names are entirely arbitrary, but you will likely want to use traditional accounting sections and subsections like assets, expenses, income, accounts receivable, accounts payable, etc. But, in the end, how you structure the accounts is entirely up to you.

## Limitations:

 * You can safely add values up to 9007199254740991 (Number.MAX_SAFE_INTEGER) and by default down to 0.000001 (precision: 7).
 * Anything more than 9007199254740991 or less than 0.000001 (precision: 7) is not guaranteed to be handled properly.

You can set the floating point precision as follows: 

```javascript
const myBook = new Book("MyBook", { precision: 8 });
```

## Writing journal entries

Writing a journal entry is very simple. First you need a `book` object:

```js
const { Book } = require("medici");

// The first argument is the book name, which is used to determine which book the transactions and journals are queried from.
const myBook = new Book("MyBook");
```

Now write an entry:

```js
// You can specify a Date object as the second argument in the book.entry() method if you want the transaction to be for a different date than today
const journal = await myBook
  .entry("Received payment")
  .debit("Assets:Cash", 1000)
  .credit("Income", 1000, { client: "Joe Blow" })
  .commit();
```

You can continue to chain debits and credits to the journal object until you are finished. The `entry.debit()` and `entry.credit()` methods both have the same arguments: (account, amount, meta).

You can use the "meta" field which you can use to store any additional information about the transaction that your application needs. In the example above, the `client` attribute is added to the transaction in the `Income` account, so you can later use it in a balance or transaction query to limit transactions to those for Joe Blow.

## Querying Account Balance

To query account balance, just use the `book.balance()` method:

```js
const { balance } = await myBook.balance({
  account: "Assets:Accounts Receivable",
  client: "Joe Blow",
});
console.log("Joe Blow owes me", balance);
```

Note that the `meta` query parameters are on the same level as the default query parameters (account, \_journal, start_date, end_date). Medici parses the query and automatically turns any values that do not match top-level schema properties into meta parameters.

## Retrieving Transactions

To retrieve transactions, use the `book.ledger()` method (here I'm using moment.js for dates):

```js
const startDate = moment().subtract("months", 1).toDate(); // One month ago
const endDate = new Date(); // today

const { results, total } = await myBook.ledger({
  account: "Income",
  start_date: startDate,
  end_date: endDate,
}, null, { lean: true });
```

## Voiding Journal Entries

Sometimes you will make an entry that turns out to be inaccurate or that otherwise needs to be voided. Keeping with traditional double-entry accounting, instead of simply deleting that journal entry, Medici instead will mark the entry as "voided", and then add an equal, opposite journal entry to offset the transactions in the original. This gives you a clear picture of all actions taken with your book.

To void a journal entry, you can either call the `void(void_reason)` method on a Medici_Journal document, or use the `book.void(journal_id, void_reason)` method if you know the journal document's ID.

```js
await myBook.void("5eadfd84d7d587fb794eaacb", "I made a mistake");
```

If you do not specify a void reason, the system will set the memo of the new journal to the original journal's memo prepended with "[VOID]".

## Document Schema

Journals are schemed in Mongoose as follows:

```js
JournalSchema = {
  datetime: Date,
  memo: {
    type: String,
    default: "",
  },
  _transactions: [
    {
      type: Schema.Types.ObjectId,
      ref: "Medici_Transaction",
    },
  ],
  book: String,
  voided: {
    type: Boolean,
    default: false,
  },
  void_reason: String,
  approved: {
    type: Boolean,
    default: true,
  },
};
```

Transactions are schemed as follows:

```js
TransactionSchema = {
  credit: Number,
  debit: Number,
  meta: Schema.Types.Mixed,
  datetime: Date,
  account_path: [String],
  accounts: String,
  book: String,
  memo: String,
  _journal: {
    type: Schema.Types.ObjectId,
    ref: "Medici_Journal",
  },
  timestamp: Date,
  voided: {
    type: Boolean,
    default: false,
  },
  void_reason: String,
  // The journal that this is voiding, if any
  _original_journal: Schema.Types.ObjectId,
  approved: {
    type: Boolean,
    default: true,
  },
};
```

Note that the `book`, `datetime`, `memo`, `voided`, and `void_reason` attributes are duplicates of their counterparts on the Journal document. These attributes will pretty much be needed on every transaction search, so they are added to the Transaction document to avoid having to populate the associated Journal every time.

### Customizing the Transaction document schema

If you need to have related documents for Transactions and want to use Mongoose's `populate` method, or if you need to add additional fields to the schema that the `meta` won't satisfy, you can define your own schema for `Medici_Transaction` and use the `setJournalSchema` and `setTransactionSchema` to use those schemas. When you specify meta values when querying or writing transactions, the system will check the Transaction schema to see if those values correspond to actual top-level fields, and if so will set those instead of the corresponding `meta` field.

For example, if you want transactions to have a related "person" document, you can define the transaction schema like so and use setTransactionSchema to register it:

```js
MyTransactionSchema = {
  _person: {
    type: Schema.Types.ObjectId,
    ref: "Person",
  },
  credit: Number,
  debit: Number,
  meta: Schema.Types.Mixed,
  datetime: Date,
  account_path: [String],
  accounts: String,
  book: String,
  memo: String,
  _journal: {
    type: Schema.Types.ObjectId,
    ref: "Medici_Journal",
  },
  timestamp: Date,
  voided: {
    type: Boolean,
    default: false,
  },
  void_reason: String,
  approved: {
    type: Boolean,
    default: true,
  },
};

setTransactionSchema(MyTransactionSchema, undefined, { defaultIndexes: true });

await syncIndexes({ background: false });
```

Then when you query transactions using the `book.ledger()` method, you can specify the related documents to populate as the second argument. E.g., `book.ledger({account:'Assets:Accounts Receivable'}, ['_person']).then()...`

## Performance

Medici v2 was slow when number of records reach 30k. Starting from v3.0 the [following](https://github.com/flash-oss/medici/commit/274528ef5d1dae0beedca4a98dbf706808be53bd) indexes are auto generated on the `medici_transactions` collection:

```
    "_journal": 1
```

```
    "accounts": 1,
    "book": 1,
    "approved": 1,
    "datetime": -1,
    "timestamp": -1
```

```
    "account_path.0": 1,
    "book": 1,
    "approved": 1
```

```
    "account_path.0": 1,
    "account_path.1": 1,
    "book": 1,
    "approved": 1
```

```
    "account_path.0": 1,
    "account_path.1": 1,
    "account_path.2": 1,
    "book": 1,
    "approved": 1
```

However, if you are doing lots of queries using the `meta` data (which is a typical scenario) you probably would want to add the following index(es):

```
    "meta.myCustomProperty": 1,
    "book": 1,
    "approved": 1,
    "datetime": -1,
    "timestamp": -1
```

and/or

```
    "meta.myCustomProperty": 1,
    "account_path.0": 1,
    "book": 1,
    "approved": 1
```

and/or

```
    "meta.myCustomProperty": 1,
    "account_path.0": 1,
    "account_path.1": 1,
    "book": 1,
    "approved": 1
```

and/or

```
    "meta.myCustomProperty": 1,
    "account_path.0": 1,
    "account_path.1": 1,
    "account_path.2": 1,
    "book": 1,
    "approved": 1
```

Here is how to add an index manually via MongoDB CLI or other tool:

```
db = db.getSiblingDB("my_db_name")
db.getCollection("medici_transactions").createIndex({
    "meta.myCustomProperty": 1,
    "book": 1,
    "approved": 1,
    "datetime": -1,
    "timestamp": -1
}, {background: true})
```

#### Index memory consumption example

For `medici_transactions` collection with 50000 documents:

- the mandatory `_id` index takes about 600 KB,
- each of the medici default indexes take from 300 to 600 KB.
- your custom indexes containing `meta.*` properties would take 600 to 1200 KB.

## Changelog

- **v5.0.0**

  - Add support for MongoDB sessions (aka ACID transactions). See `IOptions` type.
  - Added a `mongoTransaction`-method, which is a convenience shortcut for `mongoose.connection.transaction`.
  - Added async helper method `initModels`, which initializes the underlying `transactionModel` and `journalModel`. Use this after you connected to  the MongoDB-Server if you want to use transactions. Or else you could get `Unable to read from a snapshot due to pending collection catalog changes; please retry the operation.`-Error when acquiring a session because the actual database-collection is still being created by the underlying mongoose-instance.
  - Node.js 12 is the lowest supported version. Although, 10 should still work fine, when using mongoose v5.
  - Mongoose v6 is the only supported version now. Avoid using both v5 and v6 in the same project.
  - MongoDB 4 and above is supported. You can still use MongoDB 3, but ACID-sessions could have issues.
  - You can't import `book` anymore. Only `Book` is supported. `require("medici").Book`.
  - The project was rewritten with TypeScript. Types are provided within the package now.
  - `.ledger()` returns lean Transaction-Objects for better performance. To retrieve hydrated Transaction-Objects, set lean to false in the third parameter of `.ledger()`. It is recommended to not hydrate the transactions, as it implies that the transactions could be manipulated and the data integrity of Medici could be risked. 
  - You can now specify the `precision`. Book now accepts an optional second parameter, where you can set the `precision` used internally by Medici. Default value is 7 digits precision. Javascript has issues with floating points precision and can only handle 16 digits precision, like 0.1 + 0.2 results in 0.30000000000000004 and not 0.3. The default precision of 7 digits after decimal, results in the correct result of 0.1 + 0.2 = 0.3. The default value is taken from medici version 4.0.2. Be careful, if you use currency, which has more decimal points, e.g. Bitcoin has a precision of 8 digits after the comma. So for Bitcoin you should set the precision to 8. You can enforce an "only-Integer"-mode, by setting the precision to 0. But keep in mind that Javascript has a max safe integer limit of 9007199254740991.
  - Added `setJournalSchema` and `setTransactionSchema` to use custom Schemas. It will ensure, that all relevant middlewares and methods are also added when using custom Schemas. Use `syncIndexes`-method from medici after setTransactionSchema to enforce the defined indexes on the models.
  - Added `maxAccountPath`. You can set the maximum amount of account paths via the second parameter of Book. This can improve the performance of `.balance()` and `.ledger()` calls as it will then use the accounts attribute of the transactions as a filter.
  - Added prototype-pollution protection when creating entries. Reserved words like `__proto__` can not be used as properties of a Transaction or a Journal or their meta-Field as they will get silently filtered. 

- **v4.0.0**

  - Node.js 8 is required now.
  - Drop support of Mongoose v4. Only v5 is supported now. (But v4 should just work, even though not tested.)
  - No API changes.

- **v3.0.0**

  - Add 4 mandatory indexes, otherwise queries get very slow when transactions collection grows.
  - No API changes.

- **v2.0.0**

  - Upgrade to use mongoose v5. To use with mongoose v4 just `npm i medici@1`.
  - Support node.js v10.
  - No API changes.

- **v1.0.0** _See [this PR](https://github.com/flash-oss/medici/pull/5) for more details_
  - **BREAKING**: Dropped support of node.js v0.10, v0.12, v4, and io.js. Node.js >= v6 is supported only. This allowed to drop several production dependencies. Also, few bugs were automatically fixed.
  - **BREAKING**: Upgraded `mongoose` to v4. This allows `medici` to be used with wider mongodb versions.
  - Dropped production dependencies: `moment`, `q`, `underscore`.
  - Dropped dev dependencies: `grunt`, `grunt-exec`, `grunt-contrib-coffee`, `grunt-sed`, `grunt-contrib-watch`, `semver`.
  - No `.coffee` any more. Using node.js v6 compatible JavaScript only.
  - There are no API changes.
  - Fixed a [bug](https://github.com/flash-oss/medici/issues/4). Transaction meta data was not voided correctly.
  - This module maintainer is now [flash-oss](https://github.com/flash-oss) instead of the original author [jraede](http://github.com/jraede).

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

- You can safely add values up to 9007199254740991 (Number.MAX_SAFE_INTEGER) and by default down to 0.00000001 (precision: 8).
- Anything more than 9007199254740991 or less than 0.00000001 (precision: 8) is not guaranteed to be handled properly.

You can set the floating point precision as follows:

```javascript
const myBook = new Book("MyBook", { precision: 7 });
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
});
```

## Voiding Journal Entries

Sometimes you will make an entry that turns out to be inaccurate or that otherwise needs to be voided. Keeping with traditional double-entry accounting, instead of simply deleting that journal entry, Medici instead will mark the entry as "voided", and then add an equal, opposite journal entry to offset the transactions in the original. This gives you a clear picture of all actions taken with your book.

To void a journal entry, you can either call the `void(void_reason)` method on a Medici_Journal document, or use the `book.void(journal_id, void_reason)` method if you know the journal document's ID.

```js
await myBook.void("5eadfd84d7d587fb794eaacb", "I made a mistake");
```

If you do not specify a void reason, the system will set the memo of the new journal to the original journal's memo prepended with "[VOID]".

## ACID checks of an account balance

Sometimes you need to guarantee that an account balance never goes negative. You can employ MongoDB ACID transactions for that. As of 2022 the recommended way is to use special Medici writelock mechanism. See comments in the code example below.

```typescript
import { Book, mongoTransaction } from "medici";

const mainLedger = new Book("mainLedger");

async function withdraw(walletId: string, amount: number) {
  return mongoTransaction(async (session) => {
    await mainLedger
      .entry("Withdraw by User")
      .credit("Assets", amount)
      .debit(`Accounts:${walletId}`, amount)
      .commit({ session });

    // .balance() can be a resource-expensive operation. So we do it after we
    // created the journal.
    const balanceAfter = await mainLedger.balance(
      {
        account: `Accounts:${walletId}`,
      },
      { session }
    );

    // Avoid spending more than the wallet has.
    // Reject the ACID transaction by throwing this exception.
    if (balanceAfter.balance < 0) {
      throw new Error("Not enough balance in wallet.");
    }

    // ISBN: 978-1-4842-6879-7. MongoDB Performance Tuning (2021), p. 217
    // Reduce the Chance of Transient Transaction Errors by moving the
    // contentious statement to the end of the transaction.

    // We writelock only the account of the User/Wallet. If we writelock a very
    // often used account, like the fictitious Assets account in this example,
    // we would slow down the database extremely as the writelocks would make
    // it impossible to concurrently write in the database.
    // We only check the balance of the User/Wallet, so only this Account has to
    // be writelocked.
    await mainLedger.writelockAccounts([`Accounts:${walletId}`], { session });
  });
}
```

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
};
```

Note that the `book`, `datetime`, `memo`, `voided`, and `void_reason` attributes are duplicates of their counterparts on the Journal document. These attributes will pretty much be needed on every transaction search, so they are added to the Transaction document to avoid having to populate the associated Journal every time.

### Customizing the Transaction document schema

If you need to add additional fields to the schema that the `meta` won't satisfy, you can define your own schema for `Medici_Transaction` and utilise the `setJournalSchema` and `setTransactionSchema` to use those schemas. When you specify meta values when querying or writing transactions, the system will check the Transaction schema to see if those values correspond to actual top-level fields, and if so will set those instead of the corresponding `meta` field.

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
};

// add an index to the Schema
MyTransactionSchema.index({ void: 1, void_reason: 1 });

// assign the Schema to the Model
setTransactionSchema(MyTransactionSchema, undefined, { defaultIndexes: true });

// Enforce the index 'void_1_void_reason_1'
await syncIndexes({ background: false });
```

## Performance

### Fast balance

In medici v5 we introduced the so-called "fast balance" feature. [Here is the discussion](https://github.com/flash-oss/medici/issues/38). TL;DR: it caches `.balance()` call result once a day (customisable) to `medici_balances` collection.

If a database has millions of records then calculating the balance on half of them would take like 5 seconds. When this result is cached it takes few milliseconds to calculate the balance after that.

#### How it works under the hood

There are two hard problems in programming: cache invalidation and naming things. (C) Phil Karlton

Be default, when you call `book.blanace(...)` for the first time medici will cache its result to `medici_balances` (aka balance snapshot). By default, every doc there will be auto-removed as they have TTL of 48 hours. Meaning this cache will definitely expire in 2 days. Although, medici will try doing a second balance snapshot every 24 hours (default value). Thus, at any point of time there will be present from zero to two snapshots per balance query.

When you would call the `book.balance(...)` with the same exact arguments the medici will:

- retrieve the most recent snapshot if present,
- sum up only transactions inserted after the snapshot, and
- add the snapshot's balance to the sum.

In a rare case you wanted to remove some ledger entries from `medici_transactions` you would also need to remove all the `medici_balances` docs. Otherwise, the `.balance()` would be returning inaccurate data for up to 24 hours.

**IMPORTANT!**

To make this feature consistent we had to switch from client-generated IDs to MongoDB server generated IDs. See [forceServerObjectId](https://mongodb.github.io/node-mongodb-native/api-generated/mongoclient.html#constructor).

#### How to disable balance caching feature

When creating a book you need to pass the `balanceSnapshotSec: 0` option.

```js
const myBook = new Book("MyBook", { balanceSnapshotSec: 0 })
```

### Indexes

Medici <=v2 was slow when number of records reach 30k. Starting from v3.0 the [following](https://github.com/flash-oss/medici/commit/274528ef5d1dae0beedca4a98dbf706808be53bd) indexes are auto generated on the `medici_transactions` collection:

```
    "_journal": 1
```

```
    "accounts": 1,
    "book": 1,
    "datetime": -1,
    "timestamp": -1
```

```
    "account_path.0": 1,
    "book": 1,
```

```
    "account_path.0": 1,
    "account_path.1": 1,
    "book": 1,
```

```
    "account_path.0": 1,
    "account_path.1": 1,
    "account_path.2": 1,
    "book": 1,
```

Added in version 5:

```
    "datetime": -1,
    "timestamp": -1
```

However, if you are doing lots of queries using the `meta` data (which is a typical scenario) you probably would want to add the following index(es):

```
    "meta.myCustomProperty": 1,
    "book": 1,
    "datetime": -1,
    "timestamp": -1
```

and/or

```
    "meta.myCustomProperty": 1,
    "account_path.0": 1,
    "book": 1,
```

and/or

```
    "meta.myCustomProperty": 1,
    "account_path.0": 1,
    "account_path.1": 1,
    "book": 1,
```

and/or

```
    "meta.myCustomProperty": 1,
    "account_path.0": 1,
    "account_path.1": 1,
    "account_path.2": 1,
    "book": 1,
```

Here is how to add an index manually via MongoDB CLI or other tool:

```
db = db.getSiblingDB("my_db_name")
db.getCollection("medici_transactions").createIndex({
    "meta.myCustomProperty": 1,
    "book": 1,
    "datetime": -1,
    "timestamp": -1
}, {background: true})
```

Keep in mind, that the order of the fields in the Index is important. Always sort them by cardinality. E.g. If your Accounts are like "Expenses:Salary:Employee1","Expenses:Salary:Employee2" etc. then the cardinality of the last account-path is bigger than from the first part. So you would order the fields in the indexes like this:

```
    "account_path.2": 1,
    "account_path.1": 1,
    "account_path.0": 1,
    "book": 1,
```

But if your Accounts are like "Employee1:Expenses:Salary", "Employee2:Expenses:Salary" than the cardinality of the first part is bigger. So you would order the fields in the indexes like this (=default Indexes):

```
    "account_path.0": 1,
    "account_path.1": 1,
    "account_path.2": 1,
    "book": 1,
```

For more information, see [Performance Best Practices: Indexing](https://www.mongodb.com/blog/post/performance-best-practices-indexing)

#### Index memory consumption example

For `medici_transactions` collection with 50000 documents:

- the mandatory `_id` index takes about 600 KB,
- each of the medici default indexes take from 300 to 600 KB.
- your custom indexes containing `meta.*` properties would take 600 to 1200 KB.

## Changelog

### 6.0

- Drop node 12 and 14 support. Only 16 and 18 are supported now.
- By default use the secondary nodes (if present) of your MongoDB cluster to calculate balances.

### v5.2

- The balances cache primary key is now a SHA1 hash of the previous value. Before: `"MyBook;Account;clientId.$in.0:12345,clientId.$in.1:67890,currency:USD"`. After: `"\u001b\u0004NÞj\u0013rÅ\u001b¼,F_#\u001cÔk Nv"`. Allows each key to be exactly 40 bytes (20 chars) regadless the actual balance query text length.
  - But the old raw unhashed key is now stored in `rawKey` of `medici_balances` for DX and troubleshooting purposes.
- Fixed important bugs #58 and #70 related to retrieving balance for a custom schema properties. Thanks @dolcalmi

### v5.1

The balance snapshots were never recalculated from the beginning of the ledger. They were always based on the most recent snapshot. It gave us speed. Although, if one of the snapshots gets corrupt or an early ledger entry gets manually edited/deleted then we would always get wrong number from the `.balance()` method. Thus, we have to calculate snapshots from the beginning of the ledger at least once in a while.

BUT! If you have millions of documents in `medici_transactions` collection a full balance recalculation might take up to 10 seconds. So, we can't afford aggregation of the entire database during the `.blance()` invocation. Solution: let's aggregate it **in the background**. Thus, v5.1 was born.

New feature:
- In addition to the existing `balanceSnapshotSec` option, we added `expireBalanceSnapshotSec`.
  - The `balanceSnapshotSec` tells medici how often you want those snapshots to be made **in the background** (right after the `.balance()` call). Default value - 24 hours.
  - The `expireBalanceSnapshotSec` tells medici when to evict those snapshots from the database (TTL). It is recommended to set `expireBalanceSnapshotSec` higher than `balanceSnapshotSec`. Default value - twice the `balanceSnapshotSec`.

### v5.0

High level overview.

- The project was rewritten with **TypeScript**. Types are provided within the package now.
- Added support for MongoDB sessions (aka **ACID** transactions). See `IOptions` type.
- Did number of consistency, stability, server disk space, and speed improvements. Balance querying on massive databases with millions of documents are going to be much-much faster now. Like 10 to 1000 times faster.
- Mongoose v5 and v6 are both supported now.

Major breaking changes:

- The "approved" feature was removed.
- Mongoose middlewares on medici models are not supported anymore.
- The `.balance()` method does not support pagination anymore.
- Rename constructor `book` -> `Book`.
- Plus some other potentially breaking changes. See below.

Step by step migration from v4 to v5.

- Adapt your code to all the breaking changes.
- On the app start medici (actually mongoose) will create all the new indexes. If you have any custom indexes containing the `approved` property, you'd need to create similar indexes but without the property.
- You'd need to manually remove all the indexes which contain `approved` property in it.
- Done.

All changes of the release.

- Added a `mongoTransaction`-method, which is a convenience shortcut for `mongoose.connection.transaction`.
- Added async helper method `initModels`, which initializes the underlying `transactionModel` and `journalModel`. Use this after you connected to the MongoDB-Server if you want to use transactions. Or else you could get `Unable to read from a snapshot due to pending collection catalog changes; please retry the operation.` error when acquiring a session because the actual database-collection is still being created by the underlying mongoose-instance.
- Added `syncIndexes`. Warning! This function will erase any custom (non-builtin) indexes you might have added.
- Added `setJournalSchema` and `setTransactionSchema` to use custom Schemas. It will ensure, that all relevant middlewares and methods are also added when using custom Schemas. Use `syncIndexes`-method from medici after setTransactionSchema to enforce the defined indexes on the models.
- Added `maxAccountPath`. You can set the maximum amount of account paths via the second parameter of Book. This can improve the performance of `.balance()` and `.ledger()` calls as it will then use the accounts attribute of the transactions as a filter.
- MongoDB v4 and above is supported. You can still try using MongoDB v3, but it's not recommended.
- Added a new `timestamp+datetime` index on the transactionModel to improve the performance of paginated ledger queries.
- Added a `lockModel` to make it possible to call `.balance()` and **get a reliable result while using a mongo-session**. Call `.writelockAccounts()` with first parameter being an Array of Accounts, which you want to lock. E.g. `book.writelockAccounts(["Assets:User:User1"], { session })`. For best performance call writelockAccounts as the last operation in the transaction. Also `.commit()` accepts the option `writelockAccounts`, where you can provide an array of accounts or a RegExp. It is recommended to use the `book.writelockAccounts()`.
- **POTENTIALLY BREAKING**: Node.js 12 is the lowest supported version. Although, 10 should still work fine.
- **POTENTIALLY BREAKING**: MongoDB v4.0 is the lowest supported version. The v3.6 support was dropped. 
- **POTENTIALLY BREAKING**: `.ledger()` returns lean Transaction-Objects (POJO) for better performance. To retrieve hydrated mongoose models set `lean` to `false` in the third parameter of `.ledger()`. It is recommended to not hydrate the transactions, as it implies that the transactions could be manipulated and the data integrity of Medici could be risked.
- **POTENTIALLY BREAKING**: Rounding precision was changed from 7 to 8 floating point digits.
  - The new default precision is 8 digits. The medici v4 had it 7 by default. Be careful if you are using values which have more than 8 digits after the comma.
  - You can now specify the `precision` in the `Book` constructor as an optional second parameter `precision`. Simulating medici v4 behaviour: `new Book("MyBook", { precision: 7 })`.
  - Also, you can enforce an "only-Integer" mode, by setting the precision to 0. But keep in mind that Javascript has a max safe integer limit of 9007199254740991.
- **POTENTIALLY BREAKING**: Added validation for `name` of Book, `maxAccountPath` and `precision`.
  - The `name` has to be not an empty string or a string containing only whitespace characters.
  - `precision` has to be an integer bigger or equal 0.
  - `maxAccountPath` has to be an integer bigger or equal 0.
- **POTENTIALLY BREAKING**: Added prototype-pollution protection when creating entries. Reserved words like `__proto__` can not be used as properties of a Transaction or a Journal or their meta-Field. They will get silently filtered out.
- **POTENTIALLY BREAKING**: When calling `book.void()` the provided `journal_id` has to belong to the `book`. If the journal does not exist within the book, medici will throw a `JournalNotFoundError`. In medici < 5 you could theoretically void a `journal` of another `book`.
- **POTENTIALLY BREAKING**: Transaction document properties `meta`, `voided`, `void_reason`, `_original_journal` won't be stored to the database when have no data. In medici v4 they were `{}`, `false`, `null`, `null` correspondingly.
- **BREAKING**: If you had any Mongoose middlewares (e.g. `"pre save"`) installed onto medici `transactionModel` or `journalModel` then they won't work anymore. Medici v5 is not using the mongoose to do DB operations. Instead, we execute commands via bare `mongodb` driver.
- **BREAKING**: `.balance()` does not support pagination anymore. To get the balance of a page sum up the values of credit and debit of a paginated `.ledger()`-call.
- **BREAKING**: You can't import `book` anymore. Only `Book` is supported. `require("medici").Book`.
- **BREAKING**: The approving functionality (`approved` and `setApproved()`) was removed. It's complicating code, bloating the DB, not used by anyone maintainers know. Please, implement approvals outside the ledger. If you still need it to be part of the ledger then you're out of luck and would have to (re)implement it yourself. Sorry about that.

### v4.0

- Node.js 8 is required now.
- Drop support of Mongoose v4. Only v5 is supported now. (But v4 should just work, even though not tested.)
- No API changes.

### v3.0

- Add 4 mandatory indexes, otherwise queries get very slow when transactions collection grows.
- No API changes.

### v2.0

- Upgrade to use mongoose v5. To use with mongoose v4 just `npm i medici@1`.
- Support node.js v10.
- No API changes.

### v1.0

_See [this PR](https://github.com/flash-oss/medici/pull/5) for more details_

- **BREAKING**: Dropped support of node.js v0.10, v0.12, v4, and io.js. Node.js >= v6 is supported only. This allowed to drop several production dependencies. Also, few bugs were automatically fixed.
- **BREAKING**: Upgraded `mongoose` to v4. This allows `medici` to be used with wider mongodb versions.
- Dropped production dependencies: `moment`, `q`, `underscore`.
- Dropped dev dependencies: `grunt`, `grunt-exec`, `grunt-contrib-coffee`, `grunt-sed`, `grunt-contrib-watch`, `semver`.
- No `.coffee` any more. Using node.js v6 compatible JavaScript only.
- There are no API changes.
- Fixed a [bug](https://github.com/flash-oss/medici/issues/4). Transaction meta data was not voided correctly.
- This module maintainer is now [flash-oss](https://github.com/flash-oss) instead of the original author [jraede](http://github.com/jraede).

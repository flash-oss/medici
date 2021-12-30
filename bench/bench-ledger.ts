import * as mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Book, initModels } from "../src";

let replSet: MongoMemoryReplSet;

(async () => {
  replSet = new MongoMemoryReplSet({
    binary: {
      version: "4.2.5",
    },
    instanceOpts: [
      // Set the expire job in MongoDB to run every second
      { args: ["--setParameter", "ttlMonitorSleepSecs=1"] },
    ],
    replSet: {
      name: "rs0",
      storageEngine: "wiredTiger",
    },
  });
  replSet.start();
  await replSet.waitUntilRunning();
  const connectionString = replSet.getUri();
  await mongoose.connect(connectionString, {
    bufferCommands: false,
    noDelay: true,
  });

  await initModels();

  const book = new Book("MyBook");

  for (let i = 0; i < 5000; i++) {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await book
      .entry(`Test Entry ${i}`, threeDaysAgo)
      .debit("Assets:Receivable", 700)
      .credit("Income:Rent", 700)
      .commit();

    i % 100 === 0 && console.log(i);
  }

  console.log("start benchmark");
  const start = Date.now();
  for (let i = 0; i < 1000; i++) {
    await book.ledger({
      account: "Income:Rent",
      perPage: 34,
      page: 5,
    });
    i % 100 === 0 && console.log(i);
  }

  console.log((Date.now() - start) / 1000);
  process.exit(0);
})();

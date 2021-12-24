import { before, after } from "mocha";
import * as mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

let replSet: MongoMemoryReplSet;

if (process.env.USE_MEMORY_REPL_SET !== "true") {
  if (process.env.CI) {
    // The GitHub's MongoDB server is a Replica Set. Thus supports ACID.
    process.env.ACID_AVAILABLE = "true";
  }
} else {
  process.env.ACID_AVAILABLE = "true";
}

before(async function () {
  this.timeout(40000);

  if (process.env.USE_MEMORY_REPL_SET !== "true") {
    await mongoose.connect("mongodb://localhost/medici_test", { serverSelectionTimeoutMS: 2500 });

    // Cleanup if there are any leftovers from the previous runs. Useful in local development.
    const db = mongoose.connection.db;
    await db.collection("medici_transactions").deleteMany({});
    await db.collection("medici_journals").deleteMany({});
    await db.collection("medici_locks").deleteMany({});
  } else {
    replSet = new MongoMemoryReplSet({
      binary: {
        version: "4.4.0",
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
    await replSet.start();
    await replSet.waitUntilRunning();
    const connectionString = replSet.getUri();
    await mongoose.connect(connectionString);
  }
});

after(async () => {
  await mongoose.disconnect();
  if (replSet) {
    await replSet.stop();
  }
});

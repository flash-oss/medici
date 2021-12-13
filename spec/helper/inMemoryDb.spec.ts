import { before, after } from "mocha";
import * as mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

let mongoConfigUrl;

let replSet: MongoMemoryReplSet;

before(async function () {
  this.timeout(40000);
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
  await mongoose.connect(connectionString);
  mongoConfigUrl = connectionString;
});

after(() => {
  mongoose.disconnect();
  replSet.stop();
});

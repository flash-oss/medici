import { before, after } from "mocha";
import * as mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

let mongoConfigUrl;

let replSet: MongoMemoryReplSet;

before(function (done: Mocha.Done) {
	this.timeout(40000);
	replSet = new MongoMemoryReplSet({
		binary: {
			version: "4.2.5",
		},
		instanceOpts: [
			// Set the expire job in MongoDB to run every second
			{ args: ["--setParameter", "ttlMonitorSleepSecs=1"] }
		],
		replSet: {
			name: "rs0",
			storageEngine: 'wiredTiger',
		},
	});
	replSet.start();
	replSet.waitUntilRunning()
		.then(() => {
			const connectionString = replSet.getUri();
			console.log(`Connecting to MongoDb`);
			mongoose.connect(
				connectionString
			).then(() => {
				console.log("Connected");
				done();
			});
			mongoConfigUrl = connectionString;
		})
});

after(() => {
	mongoose.disconnect();
	console.log("Disconnected from MongoDb");
	replSet.stop();
	console.log("Stopped MongoDb");
});

export const getMongoConfigUrl = () => mongoConfigUrl;
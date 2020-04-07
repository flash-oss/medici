const mongoose = require("mongoose");
mongoose.Promise = global.Promise;

mongoose.set("debug", true);

before(async () => {
  await mongoose.connect("mongodb://localhost/medici_test", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false
  });
  mongoose.connection.collections.medici_transactions.drop();
  mongoose.connection.collections.medici_journals.drop();
});

after(async () => {
  try {
    await mongoose.connection.db.dropDatabase();
  } catch (err) {
    console.error("Couldn't drop medici_test DB", err);
  }
  await mongoose.connection.close();
});

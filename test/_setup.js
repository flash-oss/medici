const mongoose = require("mongoose");
// mongoose.set("debug", true); // Uncomment to see which operations Mongoose is doing

require("should");

exports.mochaHooks = {
  async beforeAll() {
    await mongoose.connect("mongodb://localhost/medici_test", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
      useFindAndModify: false
    });
    await mongoose.connection.collections.medici_transactions.drop().catch(() => {});
    await mongoose.connection.collections.medici_journals.drop().catch(() => {});
  },

  async afterAll() {
    try {
      await mongoose.connection.db.dropDatabase();
    } catch (err) {
      console.error("Couldn't drop medici_test DB", err);
    }
    await mongoose.connection.close();
  }
};

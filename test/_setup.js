const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

mongoose.set('debug', true);

before(function(done) {
  mongoose
    .connect('mongodb://localhost/medici_test')
    .then(() => {
      mongoose.connection.collections.medici_transactions.drop();
      mongoose.connection.collections.medici_journals.drop();
      done();
    })
    .catch(done);
});

after(function(done) {
  mongoose.connection.db.dropDatabase(function(err) {
    if (err) {
      console.log(err);
    } else {
      console.log('Successfully dropped db');
    }
    mongoose.connection.close(done);
  });
});

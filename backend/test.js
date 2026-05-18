const m = require('mongoose');
const User = require('./src/models/User');
require('dotenv').config();

m.connect('mongodb://127.0.0.1:27017/petro-valve-workflow').then(async () => {
  const query = { email: { $regex: '^jeetdodia22@gnu.ac.in$', $options: 'i' } };
  console.log("Query:", query);
  const u = await User.findOne(query);
  console.log("Found user:", u ? u.name : "NULL");
  process.exit(0);
});

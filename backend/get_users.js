require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const users = await User.find({}).select('email role fullName isActive');
  console.log(JSON.stringify(users, null, 2));
  process.exit(0);
})();

const mongoose = require('mongoose');
const User = require('./src/models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/petro-valve-workflow').then(async () => {
  try {
    await mongoose.connection.db.collection('users').deleteMany({});
    await mongoose.connection.db.collection('tokens').deleteMany({});
    console.log('Cleared old users and tokens');

    await User.create({
      name: 'Super Admin',
      mobile_number: '0000000000',
      email: 'admin@company.com',
      password: 'password123',
      role: 'SUPER_ADMIN',
      is_active: true,
      is_verified: true
    });
    console.log('Admin freshly seeded!');
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
});

const mongoose = require('mongoose');
const User = require('./src/models/User');
require('dotenv').config();

const seedAdmin = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) throw new Error('MONGODB_URI not found in environment');

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected!');

    const adminData = {
      name: 'Super Admin',
      mobile_number: '9876543210',
      email: 'admin@petrovalve.com',
      password: 'adminpassword123',
      role: 'SUPER_ADMIN',
      department: 'Admin',
      is_active: true,
      is_verified: true
    };

    // Check if user exists
    const existing = await User.findOne({ email: adminData.email });
    if (existing) {
      console.log('Admin user already exists. Updating password...');
      existing.password = adminData.password;
      await existing.save();
      console.log('Updated successfully!');
    } else {
      console.log('Creating new Admin user...');
      await User.create(adminData);
      console.log('Created successfully!');
    }

    console.log('-----------------------------------');
    console.log('Login Email:    ' + adminData.email);
    console.log('Login Password: ' + adminData.password);
    console.log('-----------------------------------');

    process.exit(0);
  } catch (err) {
    console.error('Error seeding admin:', err);
    process.exit(1);
  }
};

seedAdmin();

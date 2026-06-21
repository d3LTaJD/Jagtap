require('dotenv').config();
const mongoose = require('mongoose');
const Role = require('./src/models/Role');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const roles = await Role.find({});
  roles.forEach(r => {
    console.log('');
    console.log('=== ' + r.name + ' (' + r.code + ') ===');
    if (r.permissions) {
      for (const [mod, perms] of r.permissions) {
        console.log('  ' + mod + ': ' + JSON.stringify(perms));
      }
    } else {
      console.log('  NO PERMISSIONS DEFINED');
    }
  });
  process.exit(0);
})();

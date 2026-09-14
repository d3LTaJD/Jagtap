const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Notification = require('../models/Notification');
  const User = require('../models/User');

  const users = await User.find({ is_active: true });
  console.log(`Found ${users.length} users:`);
  users.forEach(u => console.log(`  ${u.fullName} (${u.role}) - ${u._id}`));

  const superAdmin = users.find(u => ['SUPER_ADMIN', 'SA'].includes(u.role));
  if (superAdmin) {
    const total = await Notification.countDocuments({ user_id: superAdmin._id });
    const unread = await Notification.countDocuments({ user_id: superAdmin._id, is_read: false });
    console.log(`\nSuperAdmin ${superAdmin.fullName}:`);
    console.log(`  Total notifications: ${total}`);
    console.log(`  Unread notifications: ${unread}`);

    const types = await Notification.aggregate([
      { $match: { user_id: superAdmin._id } },
      { $group: { _id: '$title', count: { $sum: 1 }, unread: { $sum: { $cond: [{ $eq: ['$is_read', false] }, 1, 0] } } } }
    ]);
    console.log('\nBreakdown by title:');
    types.forEach(t => console.log(`  "${t._id}": total=${t.count}, unread=${t.unread}`));

    const latest = await Notification.find({ user_id: superAdmin._id }).sort('-created_at').limit(5);
    console.log('\nLatest 5 notifications:');
    latest.forEach(n => console.log(`  [${n.created_at?.toISOString()}] (${n.type}) ${n.title} - ${n.message} (read: ${n.is_read})`));
  }

  await mongoose.disconnect();
}

run().catch(console.error);

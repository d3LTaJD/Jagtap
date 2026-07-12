require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const counts = await db.collection('enquiries').aggregate([
    { $group: { _id: '$productCategory', count: { $sum: 1 } } }
  ]).toArray();
  console.log('Enquiries counts by category:', counts);

  const pCounts = await db.collection('enquiries').aggregate([
    { $unwind: '$products' },
    { $group: { _id: '$products.category', count: { $sum: 1 } } }
  ]).toArray();
  console.log('Products counts by category:', pCounts);

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

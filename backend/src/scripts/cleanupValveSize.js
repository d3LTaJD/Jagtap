require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const collection = db.collection('fielddefinitions');

  // Mark 6a21c4c6fe24536c00eda020 as deleted
  const res = await collection.updateOne(
    { _id: new mongoose.Types.ObjectId('6a21c4c6fe24536c00eda020') },
    { $set: { isDeleted: true, isActive: false } }
  );
  console.log('Update result:', res);

  process.exit(0);
}
run().catch(err => {
  console.error(err);
  process.exit(1);
});

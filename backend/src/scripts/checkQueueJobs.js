require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const jobs = await db.collection('queuejobs').find({}).sort({ createdAt: -1 }).limit(10).toArray();
  console.log('Recent Queue Jobs:', jobs.map(j => ({ id: j.jobId, name: j.queueName, status: j.status, error: j.error, createdAt: j.createdAt })));

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

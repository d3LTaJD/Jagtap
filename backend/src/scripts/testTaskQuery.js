const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

async function testTaskQuery() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const Task = require('../models/Task');
  const Enquiry = require('../models/Enquiry');

  const enquiries = await Enquiry.find({}).select('_id enquiryId').lean();
  console.log(`Found ${enquiries.length} enquiries.`);

  for (const enq of enquiries) {
    const tasks = await Task.find({ linkedEnquiry: enq._id }).lean();
    console.log(`Enquiry [${enq.enquiryId}] (_id: ${enq._id}): has ${tasks.length} task(s)`);
    tasks.forEach(t => {
      console.log(`   -> Task [${t.taskId || t._id}] "${t.title}" (status: ${t.status})`);
    });
  }

  const unlinked = await Task.find({ $or: [{ linkedEnquiry: null }, { linkedEnquiry: { $exists: false } }] }).lean();
  console.log(`\nUnlinked Tasks count: ${unlinked.length}`);
  unlinked.forEach(t => {
    console.log(`   -> Unlinked Task [${t.taskId || t._id}] "${t.title}"`);
  });

  await mongoose.disconnect();
}

testTaskQuery().catch(console.error);

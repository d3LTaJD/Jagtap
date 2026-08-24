const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

async function debugTasks() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const Task = require('../models/Task');
  const Enquiry = require('../models/Enquiry');

  const allTasks = await Task.find({}).lean();
  console.log(`Total Tasks in DB: ${allTasks.length}`);

  for (const t of allTasks) {
    console.log(`Task [${t.taskId || t._id}] Title: "${t.title}" | linkedEnquiry: ${t.linkedEnquiry} (type: ${typeof t.linkedEnquiry})`);
  }

  const allEnquiries = await Enquiry.find({}).select('_id enquiryId customer').lean();
  console.log(`\nTotal Enquiries in DB: ${allEnquiries.length}`);
  for (const e of allEnquiries) {
    console.log(`Enquiry _id: ${e._id} | enquiryId: ${e.enquiryId}`);
  }

  await mongoose.disconnect();
}

debugTasks().catch(console.error);

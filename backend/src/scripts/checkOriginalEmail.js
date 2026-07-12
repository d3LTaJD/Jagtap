require('dotenv').config();
const mongoose = require('mongoose');
const Enquiry = require('../models/Enquiry');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const enquiry = await Enquiry.findOne({ enquiryId: 'ENQ-2026-07-0014' }).populate('attachmentsList');
  const db = mongoose.connection.db;
  const emailMsg = await db.collection('emailmessages').findOne({ threadId: enquiry.threadId });
  console.log('--- Email Subject ---');
  console.log(emailMsg?.subject);
  console.log('\n--- Email Body ---');
  console.log(emailMsg?.bodyText);
  
  if (enquiry.attachmentsList) {
    enquiry.attachmentsList.forEach((att, i) => {
      console.log(`\n--- Attachment ${i + 1}: ${att.originalFileName} ---`);
      console.log(att.extractedText?.substring(0, 1000));
    });
  }
  process.exit(0);
}

run().catch(console.error);

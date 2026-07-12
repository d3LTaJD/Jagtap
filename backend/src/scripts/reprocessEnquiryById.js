require('dotenv').config();
const mongoose = require('mongoose');
const { handleAIExtraction } = require('../services/queueHandlers');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const enquiryId = 'ENQ-2026-07-0013';
  const enq = await db.collection('enquiries').findOne({ enquiryId });
  
  if (!enq) {
    console.error(`Enquiry ${enquiryId} not found.`);
    process.exit(1);
  }

  // Find the email message
  const emailMsg = await db.collection('emailmessages').findOne({ threadId: enq.threadId });
  if (!emailMsg) {
    console.error(`Associated email message for threadId ${enq.threadId} not found.`);
    process.exit(1);
  }

  console.log(`Cleaning up old records for ${enquiryId}...`);
  // Delete follow-ups
  const fuDelete = await db.collection('followups').deleteMany({ enquiry: enq._id });
  console.log(`Deleted ${fuDelete.deletedCount} follow-ups.`);

  // Delete the enquiry itself
  const enqDelete = await db.collection('enquiries').deleteOne({ _id: enq._id });
  console.log(`Deleted enquiry ${enquiryId}.`);

  // Reset email message status
  await db.collection('emailmessages').updateOne(
    { _id: emailMsg._id },
    { $set: { processingStatus: 'Pending', emailCategory: null } }
  );

  console.log(`Running handleAIExtraction pipeline for email: ${emailMsg._id}...`);
  
  // Call AI Ingestion/Extraction
  await handleAIExtraction({ emailMessageId: emailMsg._id.toString() });

  console.log('Reprocessing triggered successfully. Now running background spec calculations.');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

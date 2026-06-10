const mongoose = require('mongoose');
const MONGO_URI = 'mongodb+srv://jeetdodia12_db_user:JD86048604%40%40@jagtap.p3fbvac.mongodb.net/petro-valve?appName=petro-valve';
mongoose.connect(MONGO_URI).then(async () => {
  const EmailMessage = require('./src/models/EmailMessage');
  const Attachment = require('./src/models/Attachment');
  const Customer = require('./src/models/Customer');
  const ProcessedEmail = require('./src/models/ProcessedEmail');
  const QueueJob = require('./src/models/QueueJob');

  const emails = await EmailMessage.find().sort({ createdAt: -1 }).limit(5);
  console.log('=== EMAIL MESSAGES (' + emails.length + ') ===');
  for (const m of emails) {
    console.log('Subject:', m.subject);
    console.log('Sender:', m.sender);
    console.log('processingStatus:', m.processingStatus);
    console.log('processingMessage:', m.processingMessage);
    console.log('Attachments:', m.attachments.length);
    console.log('---');
  }

  const customers = await Customer.find().sort({ createdAt: -1 }).limit(5);
  console.log('\n=== CUSTOMERS (' + customers.length + ') ===');
  for (const c of customers) {
    console.log('Email:', c.emailAddress, '| Company:', c.companyName);
  }

  const processed = await ProcessedEmail.find().sort({ createdAt: -1 }).limit(5);
  console.log('\n=== PROCESSED EMAILS (' + processed.length + ') ===');
  for (const p of processed) {
    console.log('Subject:', p.subject, '| Sender:', p.sender, '| MsgId:', p.messageId ? p.messageId.substring(0,30) : 'NONE');
  }

  const jobs = await QueueJob.find({ status: { $in: ['Failed', 'Processing'] } }).sort({ createdAt: -1 }).limit(10);
  console.log('\n=== FAILED/STUCK QUEUE JOBS (' + jobs.length + ') ===');
  for (const j of jobs) {
    console.log('Queue:', j.queueName, '| Status:', j.status, '| Attempts:', j.attempts);
    console.log('Error:', j.lastError);
    if (j.errorLogs && j.errorLogs.length) {
      console.log('Last Error Log:', j.errorLogs[j.errorLogs.length-1].message);
    }
    console.log('---');
  }

  const allJobs = await QueueJob.find().sort({ createdAt: -1 }).limit(10);
  console.log('\n=== ALL RECENT QUEUE JOBS (' + allJobs.length + ') ===');
  for (const j of allJobs) {
    console.log(j.queueName, '|', j.status, '| err:', j.lastError || 'none');
  }

  process.exit(0);
}).catch(function(e) { console.error('FATAL:', e.message, e.stack); process.exit(1); });

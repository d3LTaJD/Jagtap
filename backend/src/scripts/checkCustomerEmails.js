const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const EmailMessage = require('../models/EmailMessage');
  const emails = await EmailMessage.find({}).sort('-createdAt').limit(10);
  emails.forEach(e => {
    console.log('--- Sender: ' + e.sender + ' | Name: ' + e.senderName + ' | Subject: ' + e.subject);
    console.log('Snippet: ' + (e.bodyText || '').substring(0, 150).replace(/\n/g, ' '));
  });
  await mongoose.disconnect();
}
run();

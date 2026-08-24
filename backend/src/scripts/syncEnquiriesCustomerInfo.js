require('dotenv').config();
const mongoose = require('mongoose');
require('../models/FieldDefinition');
const Enquiry = require('../models/Enquiry');
const Customer = require('../models/Customer');
const EmailMessage = require('../models/EmailMessage');
const { extractContactDetails } = require('../services/extraction/contactExtractor');

async function syncAllEnquiriesCustomerInfo() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[Fix] Connected to MongoDB...');

  const enquiries = await Enquiry.find().populate('customer');
  console.log(`[Fix] Found ${enquiries.length} enquiries to evaluate.`);

  for (const enq of enquiries) {
    let emailText = '';
    let emailMsg = null;
    if (enq.originalMessageId) {
      emailMsg = await EmailMessage.findOne({ messageId: enq.originalMessageId });
    }
    if (!emailMsg && enq.threadId) {
      emailMsg = await EmailMessage.findOne({ threadId: enq.threadId });
    }

    if (emailMsg && (emailMsg.bodyText || emailMsg.snippet)) {
      emailText = emailMsg.bodyText || emailMsg.snippet;
      const extracted = extractContactDetails(emailText, emailMsg.sender, emailMsg.senderName);
      
      console.log(`[Fix] Enquiry ${enq.enquiryId}:`, extracted);

      if (extracted.contactPerson) enq.contactPerson = extracted.contactPerson;
      if (extracted.mobileNumber) enq.contactMobile = extracted.mobileNumber;
      if (extracted.contactEmail) enq.contactEmail = extracted.contactEmail;
      if (extracted.companyName) enq.senderCompany = extracted.companyName;

      await enq.save();

      if (enq.customer) {
        if (extracted.contactPerson && (enq.customer.primaryContactName === 'ab cd' || enq.customer.primaryContactName === 'Email Sender')) {
          enq.customer.primaryContactName = extracted.contactPerson;
        }
        if (extracted.companyName && enq.customer.companyName === 'Individual Customer') {
          enq.customer.companyName = extracted.companyName;
        }
        if (extracted.mobileNumber && enq.customer.mobileNumber === '0000000000') {
          enq.customer.mobileNumber = extracted.mobileNumber;
        }
        await enq.customer.save();
      }
    }
  }

  console.log('[Fix] All enquiries customer info synchronized successfully! ✅');
  process.exit(0);
}

syncAllEnquiriesCustomerInfo().catch(err => {
  console.error('[Fix] Error:', err);
  process.exit(1);
});

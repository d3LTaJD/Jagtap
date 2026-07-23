const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const Enquiry = require('../models/Enquiry');
const FieldDefinition = require('../models/FieldDefinition');

async function checkEnquiry() {
  await mongoose.connect(process.env.MONGODB_URI);
  const enquiries = await Enquiry.find({});
  console.log('\n--- ENQUIRIES STATUS ---');
  enquiries.forEach(e => {
    console.log(`ID: ${e._id} | EnquiryID: ${e.enquiryId} | Status: "${e.status}" | Conf: ${e.extractionConfidence}% | Category: ${e.productCategory}`);
  });
  await mongoose.disconnect();
}

checkEnquiry();

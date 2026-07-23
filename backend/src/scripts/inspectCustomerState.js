const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const Customer = require('../models/Customer');
const Enquiry = require('../models/Enquiry');

async function inspectDb() {
  const uri = process.env.MONGODB_URI;
  console.log('Connecting to URI:', uri ? uri.substring(0, 30) + '...' : 'undefined');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const customers = await Customer.find({});
  console.log('\n--- CUSTOMERS IN DB ---');
  customers.forEach(c => {
    console.log(`ID: ${c._id} | ID_Str: ${c.customerId} | Name: "${c.companyName}" | Email: ${c.emailAddress} | Contact: ${c.primaryContactName}`);
  });

  const enquiries = await Enquiry.find({}).populate('customer');
  console.log('\n--- ENQUIRIES IN DB ---');
  enquiries.forEach(e => {
    console.log(`ENQ ID: ${e.enquiryId} | Customer Company: "${e.customer?.companyName}" | Sender Email: "${e.contactEmail}" | Client/Owner: "${e.clientName}" | Category: "${e.productCategory}"`);
  });

  await mongoose.disconnect();
}

inspectDb();

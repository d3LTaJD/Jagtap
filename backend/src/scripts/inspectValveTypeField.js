const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const FieldDefinition = require('../models/FieldDefinition');
const Enquiry = require('../models/Enquiry');

async function inspect() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB...');

  const fields = await FieldDefinition.find({ fieldName: 'valve_type' });
  console.log('\n--- FieldDefinition for valve_type ---');
  fields.forEach(f => {
    console.log(`ID: ${f._id}`);
    console.log(`Label: ${f.fieldLabel}`);
    console.log(`Context: ${f.formContext}`);
    console.log(`Category: ${f.productCategory}`);
    console.log(`Type: ${f.fieldType}`);
    console.log(`Options:`, f.options);
    console.log('-----------------------------------');
  });

  const latestEnquiry = await Enquiry.findOne({ enquiryId: 'ENQ-2026-07-0021' });
  if (latestEnquiry) {
    console.log('\n--- Latest Enquiry ENQ-2026-07-0021 ---');
    console.log('productCategory:', latestEnquiry.productCategory);
    console.log('productDescription:', latestEnquiry.productDescription);
    console.log('products:', JSON.stringify(latestEnquiry.products, null, 2));
    console.log('dynamicFields:', JSON.stringify(latestEnquiry.dynamicFields, null, 2));
  } else {
    console.log('ENQ-2026-07-0021 not found, fetching latest enquiry:');
    const last = await Enquiry.findOne().sort({ createdAt: -1 });
    if (last) {
      console.log('Enquiry ID:', last.enquiryId);
      console.log('productDescription:', last.productDescription);
      console.log('products:', JSON.stringify(last.products, null, 2));
      console.log('dynamicFields:', JSON.stringify(last.dynamicFields, null, 2));
    }
  }

  await mongoose.disconnect();
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});

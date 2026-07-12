require('dotenv').config();
const mongoose = require('mongoose');
const Enquiry = require('../models/Enquiry');
require('../models/Attachment');
require('../models/FieldDefinition');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const enquiry = await Enquiry.findOne({ enquiryId: 'ENQ-2026-07-0014' });
  if (!enquiry) {
    console.error('Enquiry not found');
    process.exit(1);
  }
  console.log('Total products:', enquiry.products.length);
  enquiry.products.forEach((prod, i) => {
    console.log(`Product ${i + 1}: desc="${prod.description}", qty=${prod.quantity}`);
    console.log(`  DynamicFields: ${JSON.stringify(prod.dynamicFields?.valve_size || null)}`);
  });
  process.exit(0);
}

run().catch(console.error);

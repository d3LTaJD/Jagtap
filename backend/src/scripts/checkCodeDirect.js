require('dotenv').config();
const mongoose = require('mongoose');
const Enquiry = require('../models/Enquiry');
const FieldDefinition = require('../models/FieldDefinition');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const enquiry = await Enquiry.findOne({ enquiryId: 'ENQ-2026-07-0014' });

  const newlyExtractedGlobal = {};
  
  const mockAIResults = [
    { valve_size: { value: '15' } }, // 1
    { valve_size: { value: '15' } }, // 2
    { valve_size: { value: '20' } }, // 3
    { valve_size: { value: '20' } }, // 4
    { valve_size: { value: '25' } }, // 5
    { valve_size: { value: '25' } }, // 6
    { valve_size: { value: '80' } }, // 7
    { valve_size: { value: '100' } }, // 8
    { valve_size: { value: '100' } }, // 9
    { valve_size: { value: '20' } }, // 10
    { valve_size: { value: '20' } }, // 11
    { valve_size: { value: '25' } }, // 12
    { valve_size: { value: '100' } }, // 13
    { valve_size: { value: '100' } }  // 14
  ];

  enquiry.products.forEach((prod, i) => {
    prod.dynamicFields = mockAIResults[i];
    Object.assign(newlyExtractedGlobal, mockAIResults[i]);
  });

  // Run the backfilling loop
  for (const [key, val] of Object.entries(newlyExtractedGlobal)) {
    if (!val) continue;
    for (const prod of enquiry.products) {
      const prodCat = prod.category || enquiry.productCategory;
      const allFields = await FieldDefinition.find({ fieldName: key, formContext: 'Enquiry', isDeleted: false });
      const fieldDef = allFields[0];
      if (fieldDef && fieldDef.productCategory && fieldDef.productCategory !== prodCat) continue;
      if (!prod.dynamicFields) prod.dynamicFields = {};
      if (!prod.dynamicFields[key] || !prod.dynamicFields[key].value) {
        prod.dynamicFields[key] = val;
      }
    }
  }

  // Set root dynamicFields
  enquiry.dynamicFields = {};
  for (const prod of enquiry.products) {
    Object.assign(enquiry.dynamicFields, prod.dynamicFields);
  }

  enquiry.markModified('products');
  enquiry.markModified('dynamicFields');
  await enquiry.save();
  console.log('Saved to DB.');

  // Fetch fresh
  const freshEnq = await Enquiry.findOne({ enquiryId: 'ENQ-2026-07-0014' });
  console.log('Fresh from DB:');
  freshEnq.products.forEach((p, i) => {
    console.log(`Item ${i + 1}: size = ${p.dynamicFields?.valve_size?.value}`);
  });

  process.exit(0);
}

run().catch(console.error);

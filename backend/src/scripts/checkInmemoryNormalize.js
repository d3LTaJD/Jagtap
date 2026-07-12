require('dotenv').config();
const mongoose = require('mongoose');
const Enquiry = require('../models/Enquiry');
const FieldDefinition = require('../models/FieldDefinition');
const aiService = require('../services/aiService');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  require('../models/Attachment');
  require('../models/FieldDefinition');
  const enquiry = await Enquiry.findOne({ enquiryId: 'ENQ-2026-07-0014' });
  
  // Clear any existing fields
  enquiry.products.forEach(p => {
    p.dynamicFields = {};
  });

  const fields = await FieldDefinition.find({ formContext: 'Enquiry', isDeleted: false, isActive: true });
  
  // Let's only process Item 3 (index 2)
  const prod = enquiry.products[2];
  console.log(`Processing Item 3: "${prod.description}"`);
  
  // Extract text
  const db = mongoose.connection.db;
  const emailMsg = await db.collection('emailmessages').findOne({ threadId: enquiry.threadId });
  const fullTextContext = emailMsg?.bodyText || '';

  const prodFields = await aiService.extractDynamicFields(fullTextContext, fields, prod.description, enquiry.enquiryId);
  console.log('AI Extracted prodFields.valve_size:', prodFields.valve_size);
  
  prod.dynamicFields = prodFields;
  console.log('After assignment in-memory:', prod.dynamicFields.valve_size);
  
  enquiry.markModified('products');
  await enquiry.save();
  
  // Fetch fresh from DB
  const freshEnq = await Enquiry.findOne({ enquiryId: 'ENQ-2026-07-0014' });
  console.log('Freshly read from DB:', freshEnq.products[2].dynamicFields?.valve_size);
  
  process.exit(0);
}

run().catch(console.error);

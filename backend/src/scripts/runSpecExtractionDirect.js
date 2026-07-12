require('dotenv').config();
const mongoose = require('mongoose');
const Enquiry = require('../models/Enquiry');
const Attachment = require('../models/Attachment');
const FieldDefinition = require('../models/FieldDefinition');
const aiService = require('../services/aiService');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const enquiryId = 'ENQ-2026-07-0014';
  const enquiry = await Enquiry.findOne({ enquiryId }).populate('attachmentsList');
  
  if (!enquiry) {
    console.error(`Enquiry ${enquiryId} not found.`);
    process.exit(1);
  }

  console.log(`Running direct specifications extraction for ${enquiryId}...`);

  // Build full context text (email body + attachment texts)
  const db = mongoose.connection.db;
  const emailMsg = await db.collection('emailmessages').findOne({ threadId: enquiry.threadId });
  let combinedExtractedText = '';
  if (enquiry.attachmentsList) {
    for (const att of enquiry.attachmentsList) {
      if (att.extractedText) {
        combinedExtractedText += `\n\n--- Attachment: ${att.originalFileName} ---\n${att.extractedText}\n`;
      }
    }
  }
  const fullTextContext = `${emailMsg?.bodyText || ''}${combinedExtractedText}`;

  enquiry.dynamicFields = {};

  if (enquiry.products && enquiry.products.length > 0) {
    const aiConfig = require('../config/aiConfig');
    const newlyExtractedGlobal = {};

    // Process all products sequentially to avoid token limit issues
    for (const prod of enquiry.products) {
      const prodCategory = prod.category || enquiry.productCategory;
      console.log(`Extracting specifications for item: "${prod.description}" (Category: ${prodCategory})...`);
      
      const fields = await FieldDefinition.find({
        formContext: 'Enquiry',
        isDeleted: false,
        isActive: true,
        $or: [
          { productCategory: prodCategory },
          { productCategory: null },
          { productCategory: '' }
        ]
      });

      console.log(`Found ${fields.length} dynamic field definitions for ${prodCategory}.`);
      const prodFields = await aiService.extractDynamicFields(fullTextContext, fields, prod.description, enquiry.enquiryId);
      prod.dynamicFields = prodFields;
      Object.assign(newlyExtractedGlobal, prodFields);
    }

    // Apply any newly extracted fields to ALL products that were missing them
    const PRODUCT_SPECIFIC_FIELDS = [
      'valve_type', 'valve_size', 'valve_class', 'valve_bore', 'valve_design_type',
      'valve_end_connection', 'valve_operating', 'valve_ball_type', 'valve_moc_body',
      'valve_moc_ball', 'valve_moc_stem', 'valve_moc_seat', 'valve_moc_stud_nuts', 'valve_qty'
    ];

    for (const [key, val] of Object.entries(newlyExtractedGlobal)) {
      if (!val) continue;
      if (PRODUCT_SPECIFIC_FIELDS.includes(key)) continue;

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

    enquiry.markModified('products');
    
    // Rebuild root dynamicFields from product fields
    for (const prod of enquiry.products) {
      Object.assign(enquiry.dynamicFields, prod.dynamicFields);
    }
    enquiry.markModified('dynamicFields');
  }

  enquiry.status = 'Confirmed';
  await enquiry.save();
  console.log(`Successfully completed specs extraction for ${enquiryId} and updated database.`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

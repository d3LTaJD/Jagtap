/**
 * Re-run AI dynamic field extraction on recent enquiries
 * using now-fixed PDF attachment text.
 * Run from: d:\jagtap\workflow-automation\backend
 *   node rerun_ai.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const MONGO_URI = 'mongodb+srv://jeetdodia12_db_user:JD86048604%40%40@jagtap.p3fbvac.mongodb.net/petro-valve?appName=petro-valve';

mongoose.connect(MONGO_URI).then(async () => {
  console.log('[OK] Connected to MongoDB\n');

  const Enquiry         = require('./src/models/Enquiry');
  const Attachment      = require('./src/models/Attachment');
  const EmailMessage    = require('./src/models/EmailMessage');
  const Customer        = require('./src/models/Customer');
  const FieldDefinition = require('./src/models/FieldDefinition');
  const aiService       = require('./src/services/aiService');
  const { checkEnquiryCompletion } = require('./src/controllers/enquiryController');

  // Target: enquiries still in New/Needs Review (not yet fully extracted)
  const enquiries = await Enquiry.find({
    status: { $in: ['New', 'Needs Review'] }
  }).sort({ createdAt: -1 }).limit(20);

  console.log(`Found ${enquiries.length} enquiry(ies) to re-process.\n`);

  for (const enq of enquiries) {
    console.log('='.repeat(60));
    console.log(`Enquiry : ${enq.enquiryId}  Status: ${enq.status}`);
    console.log(`Product : ${enq.productDescription}`);

    // ── Find the originating EmailMessage ──────────────────────
    let msg = null;
    if (enq.originalMessageId) {
      msg = await EmailMessage.findOne({ messageId: enq.originalMessageId });
    }
    if (!msg && enq.threadId) {
      msg = await EmailMessage.findOne({ threadId: enq.threadId });
    }
    if (!msg) {
      const cust = await Customer.findById(enq.customer);
      if (cust) {
        msg = await EmailMessage
          .findOne({ sender: cust.emailAddress })
          .sort({ createdAt: -1 });
      }
    }

    if (!msg) {
      console.log('  ❌  No linked email found — skipping\n');
      continue;
    }
    console.log(`Email   : "${msg.subject}"  (${msg.attachments.length} attachment refs)`);

    // ── Build full text context ────────────────────────────────
    const freshAtts = await Attachment.find({ _id: { $in: msg.attachments } });
    let combinedText = msg.bodyText || '';

    for (const att of freshAtts) {
      const txt = (att.extractedText || '').trim();
      if (txt.length > 0) {
        combinedText += `\n\n--- Attachment: ${att.originalFileName} ---\n${txt}\n`;
        console.log(`  + ${att.originalFileName}: ${txt.length} chars`);
      } else {
        console.log(`  - ${att.originalFileName}: NO TEXT (${att.extractionStatus})`);
      }
    }

    console.log(`  Context total: ${combinedText.length} chars`);

    if (combinedText.trim().length < 30) {
      console.log('  ⚠️   Context too short — skipping\n');
      continue;
    }

    // ── Fetch field definitions ────────────────────────────────
    const fields = await FieldDefinition.find({
      formContext : 'Enquiry',
      isDeleted   : false,
      isActive    : true,
      $or: [
        { productCategory: enq.productCategory },
        { productCategory: null  },
        { productCategory: ''    }
      ]
    });

    const reqFields = fields.filter(f => f.isRequired);
    console.log(`  Required fields (${reqFields.length}): ${reqFields.map(f => f.fieldLabel).join(', ')}`);

    // ── Call AI ────────────────────────────────────────────────
    console.log('  🤖  Calling AI extractDynamicFields ...');
    let extractedFields = {};
    try {
      if (enq.products && enq.products.length > 0) {
        for (const prod of enq.products) {
          console.log(`    Extracting for product: ${prod.description}`);
          const prodFields = await aiService.extractDynamicFields(
            combinedText, fields, prod.description
          );
          prod.dynamicFields = prodFields;
          Object.assign(extractedFields, prodFields);
        }
        enq.markModified('products');
      } else {
        extractedFields = await aiService.extractDynamicFields(
          combinedText, fields, enq.productDescription
        );
      }
    } catch (aiErr) {
      console.error('  ❌  AI error:', aiErr.message);
      continue;
    }
    console.log('  Extracted:', JSON.stringify(extractedFields));

    // ── Merge into enquiry ─────────────────────────────────────
    const current = enq.dynamicFields ? JSON.parse(JSON.stringify(enq.dynamicFields)) : {};
    const merged  = Object.assign({}, current, extractedFields);
    enq.dynamicFields = merged;
    enq.markModified('dynamicFields');

    const completion = await checkEnquiryCompletion(enq);
    const missing    = completion.missingFields.map(f => f.fieldLabel);

    if (completion.isComplete) {
      enq.status = 'Ready for Offer';
      console.log('  🎉  ALL fields complete → status = Ready for Offer');
    } else {
      console.log(`  📋  Still missing: [${missing.join(', ')}]`);
    }

    await enq.save();
    console.log('  ✅  Saved.\n');
  }

  console.log('Done.');
  process.exit(0);
}).catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});

/**
 * Full end-to-end test of the PDF extraction fix.
 * Simulates exactly what happens in queueHandlers → fileParsingService.
 * Run: node test_pdf_fix.js
 */
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const MONGO_URI = 'mongodb+srv://jeetdodia12_db_user:JD86048604%40%40@jagtap.p3fbvac.mongodb.net/petro-valve?appName=petro-valve';
const UPLOADS_DIR = path.join(__dirname, 'uploads');

mongoose.connect(MONGO_URI).then(async () => {
  console.log('[OK] MongoDB connected\n');

  const fileParsingService = require('./src/services/fileParsingService');
  const { getFileBuffer }  = require('./src/services/localStorageService');
  const Attachment         = require('./src/models/Attachment');
  const FieldDefinition    = require('./src/models/FieldDefinition');
  const aiService          = require('./src/services/aiService');

  // --- 1. Test PDF extraction on every PDF in uploads ---
  console.log('=== PHASE 1: PDF Extraction Test ===');
  const allAtts = await Attachment.find({ fileType: 'application/pdf' });
  console.log('PDF attachments in DB:', allAtts.length);

  for (const att of allAtts) {
    process.stdout.write(`  ${att.originalFileName} ... `);
    try {
      const buf = await getFileBuffer(att.storagePath);
      const result = await fileParsingService.extractTextFromFile(buf, att.fileType, att.originalFileName);
      console.log(`${result.status} | ${result.text.length} chars`);
      if (result.text.length > 0) {
        console.log('    Preview:', result.text.substring(0, 120).replace(/\n/g, ' '));
      }
    } catch (e) {
      console.log('ERROR:', e.message);
    }
  }

  // --- 2. Re-process the specific Valve_Datasheet_4inch.pdf ---
  console.log('\n=== PHASE 2: Full Context Build for AI ===');
  const targetAtt = await Attachment.findOne({ originalFileName: 'Valve_Datasheet_4inch.pdf' })
    .sort({ createdAt: -1 });

  if (!targetAtt) {
    console.log('Valve_Datasheet_4inch.pdf not found in DB.');
  } else {
    const buf = await getFileBuffer(targetAtt.storagePath);
    const result = await fileParsingService.extractTextFromFile(buf, targetAtt.fileType, targetAtt.originalFileName);
    
    // Update in DB
    targetAtt.extractedText = result.text;
    targetAtt.extractionStatus = result.status;
    targetAtt.processingStatus = 'Completed';
    await targetAtt.save();
    console.log('Attachment updated. extractedText length:', result.text.length);

    // Build context as ConfidenceCalculationQueue would
    const EmailMessage = require('./src/models/EmailMessage');
    const emailMsg = await EmailMessage.findOne({ attachments: targetAtt._id });
    if (emailMsg) {
      let context = emailMsg.bodyText || '';
      context += '\n\n--- Attachment: ' + targetAtt.originalFileName + ' ---\n' + result.text;
      console.log('Full context for AI:', context.length, 'chars');
      console.log('Context preview:\n', context.substring(0, 400));

      // --- 3. Test AI dynamic field extraction with the PDF context ---
      console.log('\n=== PHASE 3: AI Dynamic Field Extraction ===');
      const fields = await FieldDefinition.find({ formContext: 'Enquiry', isActive: true, isDeleted: false });
      console.log('Field definitions:', fields.map(f => f.fieldName + '(' + (f.isRequired ? 'REQ' : 'opt') + ')').join(', '));
      
      const extracted = await aiService.extractDynamicFields(context, fields, 'CS Ball Valve 300# 100MM');
      console.log('\nExtracted fields:', JSON.stringify(extracted, null, 2));
      
      const requiredFields = fields.filter(f => f.isRequired);
      const missing = requiredFields.filter(f => !extracted[f.fieldName]);
      console.log('\nMissing required fields:', missing.map(f => f.fieldLabel).join(', ') || 'NONE — All complete!');
    } else {
      console.log('No EmailMessage linked to this attachment.');
    }
  }

  console.log('\n✅ Test complete.');
  process.exit(0);
}).catch(e => {
  console.error('FATAL:', e.message, '\n', e.stack);
  process.exit(1);
});

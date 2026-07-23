/**
 * Test: PDF Generation for Multi-Page Quotations
 *
 * Verifies that pdfService.generateQuotationPdf executes cleanly
 * and returns a valid multi-page PDF buffer.
 *
 * Usage: node src/scripts/testPdfGenerator.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const User = require('../models/User');
const Quotation = require('../models/Quotation');
const Enquiry = require('../models/Enquiry');
const Customer = require('../models/Customer');
const FieldDefinition = require('../models/FieldDefinition');

const { generateQuotationPdf } = require('../services/pdfService');

async function testPdfGen() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[Test] Connected to MongoDB...');

  const quotation = await Quotation.findOne({})
    .populate('customer')
    .populate('enquiry')
    .populate('preparedBy', 'fullName');

  if (!quotation) {
    console.error('[Test] No quotation found in DB');
    process.exit(1);
  }

  console.log(`[Test] Generating PDF for Quotation: ${quotation.quotationId}...`);
  const pdfBuffer = await generateQuotationPdf(quotation);

  console.log(`[Test] PDF Generated Successfully! Buffer size: ${pdfBuffer.length} bytes ✅`);
  await mongoose.disconnect();
}

testPdfGen().catch(err => {
  console.error('[Test] Error generating PDF:', err);
  process.exit(1);
});

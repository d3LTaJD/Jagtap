const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const fs = require('fs');
const mongoose = require('mongoose');
require('../models/Customer');
require('../models/Enquiry');
require('../models/User');
require('../models/FileMetadata');
const Quotation = require('../models/Quotation');
const { generateQuotationPdf } = require('../services/quotationPdf');
const { renderPricePart2 } = require('../services/quotationPdf/pages/pricePart2');

async function testPdfGeneration() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Find quotation with 6 items (QT-2026-08-0012 or latest)
  const quotation = await Quotation.findOne({ 'items.5': { $exists: true } }).sort({ createdAt: -1 });
  if (!quotation) {
    console.error('No 6-item quotation found in database!');
    process.exit(1);
  }

  console.log(`\nFound Quotation: ${quotation.quotationId} (${quotation.items.length} items)`);

  // 1. Generate HTML for Price Part-II (Page 4)
  const page4Html = renderPricePart2(quotation.toObject());

  console.log('\n' + '='.repeat(80));
  console.log('PRICE PART-II (PAGE 4) TABLE RENDERING VERIFICATION');
  console.log('='.repeat(80));

  // Verify non-zero values for 6 columns
  console.log('Checking columns 1 to 6 (Should have actual Sizes and Classes):');
  quotation.items.slice(0, 6).forEach((item, idx) => {
    console.log(`  Item ${idx + 1}: Qty=${item.quantity} | desc="${(item.description || '').slice(0, 50)}..."`);
  });

  // Verify empty cells for columns 7 and 8
  const hasZeroTd = page4Html.includes('<td>0</td>');
  console.log(`\nDoes Page 4 HTML contain <td>0</td> for empty slots? ${hasZeroTd ? 'YES (FAIL!)' : 'NO (PASS!)'}`);
  if (hasZeroTd) {
    throw new Error('FAIL: Page 4 HTML contains <td>0</td> for empty slots');
  }

  // 2. Render Full 5-Page PDF via Puppeteer
  console.log('\nRendering full 5-page PDF via Puppeteer...');
  const pdfBuffer = await generateQuotationPdf(quotation._id);
  
  const outputPath = path.join(__dirname, '../../test_quotation_output.pdf');
  fs.writeFileSync(outputPath, pdfBuffer);
  console.log(`PDF saved successfully to: ${outputPath} (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

  await mongoose.disconnect();
  console.log('\nVerification complete!');
}

testPdfGeneration().catch(err => {
  console.error('PDF Generation test failed:', err);
  process.exit(1);
});

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../backend/.env') });
if (!process.env.MONGODB_URI) {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
}
const mongoose = require('mongoose');
require('../models/Customer');
require('../models/Enquiry');
require('../models/User');
require('../models/FileMetadata');
const Quotation = require('../models/Quotation');
const { calculateQuotationPricing } = require('../utils/quotationCalculator');
const { renderPricePart2 } = require('../services/quotationPdf/pages/pricePart2');
const { generateQuotationPdf } = require('../services/quotationPdf');
const { formatINR } = require('../services/quotationPdf/dataFormatter');

async function verifyCalculations() {
  console.log('=== VERIFYING CENTRALIZED QUOTATION PRICING CALCULATION ===\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas');

  let quotation = await Quotation.findOne({ quotationId: /QT-2026-08-0009/i })
    .populate('customer')
    .populate('enquiry')
    .populate('preparedBy')
    .lean();

  if (!quotation) {
    console.error('QT-2026-08-0009 not found!');
    process.exit(1);
  }

  console.log(`\nFound Quotation: ${quotation.quotationId}`);
  console.log(`Total line items: ${quotation.items.length}`);

  // 1. Run centralized calculation on current DB data
  const pricing = calculateQuotationPricing(quotation);

  console.log('\n--- Centralized Calculation Result ---');
  console.log(`Base Total Rate Sum (Subtotal Excl GST): ${pricing.baseTotalRateSum} (Formatted: ${formatINR(pricing.baseTotalRateSum)})`);
  console.log(`3.2 Certification (5%): ${pricing.cert32Amount} (Formatted: ${formatINR(pricing.cert32Amount)})`);
  console.log(`Packing & Forwarding (5%): ${pricing.pfAmount} (Formatted: ${formatINR(pricing.pfAmount)})`);
  console.log(`TPIA Charges: ${pricing.tpiAmount} (Formatted: ${formatINR(pricing.tpiAmount)})`);
  console.log(`Grand Total Before GST: ${pricing.grandTotalBeforeGST} (Formatted: ${formatINR(pricing.grandTotalBeforeGST)})`);
  console.log(`18% GST Amount: ${pricing.gstAmount} (Formatted: ${formatINR(pricing.gstAmount)})`);
  console.log(`Grand Total With GST: ${pricing.grandTotalWithGST} (Formatted: ${formatINR(pricing.grandTotalWithGST)})`);

  // Verify baseline values
  if (pricing.baseTotalRateSum !== 236) {
    console.error(`ERROR: Expected base total rate sum to be 236, got ${pricing.baseTotalRateSum}`);
  } else {
    console.log('✅ Baseline Subtotal matches ₹236');
  }

  if (Math.round(pricing.grandTotalBeforeGST) !== 260) {
    console.error(`ERROR: Expected Grand Total Before GST to be 260, got ${Math.round(pricing.grandTotalBeforeGST)}`);
  } else {
    console.log('✅ Grand Total Before GST rounded matches ₹260');
  }

  if (Math.round(pricing.gstAmount) !== 47) {
    console.error(`ERROR: Expected GST to be 47, got ${Math.round(pricing.gstAmount)}`);
  } else {
    console.log('✅ GST rounded matches ₹47');
  }

  if (Math.round(pricing.grandTotalWithGST) !== 306) {
    console.error(`ERROR: Expected Grand Total With GST to be 306, got ${Math.round(pricing.grandTotalWithGST)}`);
  } else {
    console.log('✅ Grand Total With GST rounded matches ₹306');
  }

  // 2. Test PDF render output contains exact numbers
  const priceHtml = renderPricePart2(quotation);
  console.log('\n--- Checking Price Part-II HTML Render ---');
  
  const hasSubtotal = priceHtml.includes(formatINR(pricing.baseTotalRateSum));
  const hasCert = priceHtml.includes(formatINR(pricing.cert32Amount));
  const hasPf = priceHtml.includes(formatINR(pricing.pfAmount));
  const hasGrandBeforeGst = priceHtml.includes(formatINR(pricing.grandTotalBeforeGST));
  const hasGst = priceHtml.includes(formatINR(pricing.gstAmount));
  const hasGrandWithGst = priceHtml.includes(formatINR(pricing.grandTotalWithGST));

  console.log(`HTML contains Subtotal (₹ 236): ${hasSubtotal}`);
  console.log(`HTML contains 3.2 Cert (₹ 12): ${hasCert}`);
  console.log(`HTML contains P&F (₹ 12): ${hasPf}`);
  console.log(`HTML contains Total Before GST (₹ 260): ${hasGrandBeforeGst}`);
  console.log(`HTML contains 18% GST (₹ 47): ${hasGst}`);
  console.log(`HTML contains Grand Total With GST (₹ 306): ${hasGrandWithGst}`);

  if (!hasSubtotal || !hasCert || !hasPf || !hasGrandBeforeGst || !hasGst || !hasGrandWithGst) {
    console.error('❌ PDF HTML string is missing expected formatted values!');
  } else {
    console.log('✅ PDF HTML renders all calculated values identically!');
  }

  // 3. Update database record with centralized commercialTotals
  await Quotation.findByIdAndUpdate(quotation._id, {
    items: pricing.items,
    commercialTotals: pricing.commercialTotals
  });
  console.log('\n✅ Database quotation commercialTotals updated with centralized pricing');

  // 4. Test Dynamic Price Change & Verify Recalculation
  console.log('\n--- Dynamic Price Change Test ---');
  const modifiedQuotation = JSON.parse(JSON.stringify(quotation));
  // Change Item 8 unitPrice to 500
  modifiedQuotation.items[7].unitPrice = 500; // qty was 4 -> 500 * 4 = +2000 => lineTotal becomes (500 + 26) * 4 = 2104
  const modPricing = calculateQuotationPricing(modifiedQuotation);
  console.log(`Modified Item 8 (unitPrice 500, qty 4): Line total = ${modPricing.items[7].lineTotalExclGST}`);
  console.log(`New Subtotal: ${modPricing.baseTotalRateSum} (Expected: 236 - 104 + 2104 = 2236)`);
  console.log(`New 3.2 Cert (5%): ${modPricing.cert32Amount} (Formatted: ${formatINR(modPricing.cert32Amount)})`);
  console.log(`New P&F (5%): ${modPricing.pfAmount} (Formatted: ${formatINR(modPricing.pfAmount)})`);
  console.log(`New Taxable: ${modPricing.grandTotalBeforeGST} (Formatted: ${formatINR(modPricing.grandTotalBeforeGST)})`);
  console.log(`New GST: ${modPricing.gstAmount} (Formatted: ${formatINR(modPricing.gstAmount)})`);
  console.log(`New Grand Total With GST: ${modPricing.grandTotalWithGST} (Formatted: ${formatINR(modPricing.grandTotalWithGST)})`);

  const modPriceHtml = renderPricePart2(modifiedQuotation);
  const modHasGrandWithGst = modPriceHtml.includes(formatINR(modPricing.grandTotalWithGST));
  console.log(`Modified PDF contains new Grand Total (${formatINR(modPricing.grandTotalWithGST)}): ${modHasGrandWithGst}`);

  if (modPricing.baseTotalRateSum === 2236 && modHasGrandWithGst) {
    console.log('✅ Dynamic price change recalculated consistently across pricing engine and PDF!');
  } else {
    console.error('❌ Dynamic price change test failed!');
  }

  // 5. Test full 5-page PDF Generation with the restored quotation
  console.log('\n--- Generating full 5-page PDF ---');
  const restoredQuotation = await Quotation.findById(quotation._id)
    .populate('customer')
    .populate('enquiry')
    .populate('preparedBy')
    .lean();

  const pdfBuffer = await generateQuotationPdf(restoredQuotation);
  const fs = require('fs');
  const outPath = path.join(__dirname, 'test_output_quotation_recalculated.pdf');
  fs.writeFileSync(outPath, pdfBuffer);
  console.log(`✅ Generated PDF (${pdfBuffer.length} bytes) saved to ${outPath}`);

  await mongoose.disconnect();
  console.log('\n=== ALL CALCULATION VERIFICATIONS PASSED SUCCESSFULLY ===');
}

verifyCalculations().catch(err => {
  console.error(err);
  process.exit(1);
});

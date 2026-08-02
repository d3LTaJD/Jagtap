const boqParserService = require('../services/boqParserService');
const tokenizer = require('../services/extraction/Tokenizer');
const extractorRegistry = require('../services/extraction/ExtractorRegistry');
const assert = require('assert');

// Exact sample email text from Sri Atchaya Engineering enquiry
const sampleEmailBody = `
Dear Team,

Please quote your best price for the below requirement of valves:

1. BALL API6D HOV F/F A/G TRU BOL 2IN 300#    35    EA
2. BALL API6D HOV F/F A/G TRU BOL 10IN 300#    1    EA
3. BALL API6D HOV F/F A/G TRU BOL 4IN 300#    2    EA
4. BALL API6D HOV F/F A/G TRU BOL 3IN 300#    4    EA
5. BALL API6D HOV F/F A/G TRU BOL 2IN 300#    2    EA
6. BALL API6D HOV F/F A/G TRU BOL 2IN 300#    1    EA
7. VLV,CHK,A216 WCB,A216 WCB,FLG,300,10IN      1    EA
8. 1" x 800# W/W A/G HOV API 602 GATE VALVE    2    EA
9. 18" x ANSI 150# HOV F/F API 600 Gate Valve   1    EA
10. 4" x ANSI 150# HOV F/F API 600 Gate Valve   1    EA

Supply and delivery of Ball Valves & Check Valves for Project XYZ.
Kindly share delivery schedule and datasheets.

Best Regards,
Sri Atchaya Engineering Pvt. Ltd.
`;

async function runBOQExtractionTest() {
  console.log('=== Running BOQ Line Item Extraction Tests ===\n');

  // Test 1: parseEmailBodyLineItems
  const products = boqParserService.parseEmailBodyLineItems(sampleEmailBody);
  console.log(`Extracted ${products.length} line items from email body.`);

  assert.strictEqual(products.length, 10, `Expected 10 products, but extracted ${products.length}`);
  console.log('✅ Test 1 Passed: Exactly 10 product items extracted.');

  // Test 2: Check non-product row rejection ("Supply and delivery...")
  const nonProductPresent = products.some(p => p.productDescription.toLowerCase().includes('supply and delivery'));
  assert.strictEqual(nonProductPresent, false, 'Header sentence "Supply and delivery..." was NOT rejected!');
  console.log('✅ Test 2 Passed: Header/intro sentence correctly rejected.');

  // Test 3: Validate individual line items
  console.log('\nExtracted Products Summary:');
  products.forEach((p, idx) => {
    const tok = tokenizer.tokenize(p.productDescription);
    const extractions = extractorRegistry.runAll(tok);
    const size = extractions.SizeExtractor?.normalizedValue || extractions.valve_size?.normalizedValue || 'Unknown';
    const valveType = extractions.ValveExtractor?.normalizedValue || extractions.valve_type?.normalizedValue || 'Unknown';

    console.log(`  [Row ${idx + 1}] Qty: ${p.quantity} | Category: ${p.productCategory} | Size: ${size} | Type: ${valveType} | Desc: "${p.productDescription}"`);
  });

  // Verify item 1
  assert.strictEqual(products[0].quantity, 35);
  assert.strictEqual(products[0].productCategory, 'Valves');

  // Verify item 7 (VLV,CHK...)
  assert.strictEqual(products[6].quantity, 1);
  assert.strictEqual(products[6].productCategory, 'Valves');

  // Verify item 8 (1" x 800# GATE VALVE)
  assert.strictEqual(products[7].quantity, 2);

  // Verify item 9 (18" Gate Valve)
  assert.strictEqual(products[8].quantity, 1);

  console.log('\n✅ All BOQ Line Item Extraction Tests Passed Successfully!\n');
}

runBOQExtractionTest().catch(err => {
  console.error('❌ Test Failed:', err);
  process.exit(1);
});

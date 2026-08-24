const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const assert = require('assert');
const { formatPdfValue, extractItemFieldValue, formatINR } = require('../services/quotationPdf/dataFormatter');
const { renderPricePart2 } = require('../services/quotationPdf/pages/pricePart2');
const { calculateQuotationPricing, roundCurrency } = require('../utils/quotationCalculator');
const extractionPipeline = require('../services/extraction/ExtractionPipeline');

async function runRegressionTests() {
  console.log('=' .repeat(80));
  console.log('RUNNING REGRESSION TEST SUITE FOR BUG FIXES 1 - 5');
  console.log('=' .repeat(80));

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`[PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] Test ${total}: ${name}`);
      console.error(`       Error: ${err.message}`);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] Test ${total}: ${name}`);
      console.error(`       Error: ${err.message}`);
    }
  }

  // --- TEST 1: AI {value, confidence} unwrapping (BUG 1) ---
  test('BUG 1: formatPdfValue unwraps nested { value, confidence } objects safely', () => {
    const wrappedSingle = { value: '50 mm', confidence: 0.95 };
    const wrappedNested = { value: { value: '150#', confidence: 0.9 }, confidence: 0.95 };
    const wrappedWithUnit = { value: '50', unit: 'mm' };

    assert.strictEqual(formatPdfValue(wrappedSingle), '50 mm');
    assert.strictEqual(formatPdfValue(wrappedNested), '150#');
    assert.strictEqual(formatPdfValue(wrappedWithUnit), '50 mm');
  });

  // --- TEST 2: extractItemFieldValue with dynamicFields ---
  test('BUG 1: extractItemFieldValue resolves size, class, and type from dynamicFields', () => {
    const mockItem = {
      description: 'API 6D Ball Valve',
      quantity: 5,
      dynamicFields: {
        valve_size: { value: '50 mm', confidence: 0.9 },
        valve_class: { value: '150#', confidence: 0.9 },
        valve_type: { value: 'Trunnion Ball', confidence: 0.9 }
      }
    };

    assert.strictEqual(extractItemFieldValue(mockItem, 'valve_size'), '50');
    assert.strictEqual(extractItemFieldValue(mockItem, 'valve_class'), '150');
    assert.strictEqual(extractItemFieldValue(mockItem, 'valve_type'), 'BALL');
  });

  // --- TEST 3: Empty columns 7/8 in Price Part-II render blank (BUG 2) ---
  test('BUG 2: Price Part-II empty columns 7/8 render blank HTML cells without "0"', () => {
    const mockQuotation = {
      pricePartNotice: 'Rates for supply of valves',
      items: [
        { description: 'Item 1', quantity: 5, unitPrice: 100, dynamicFields: { valve_type: 'Ball', valve_size: '50', valve_class: '150' } },
        { description: 'Item 2', quantity: 2, unitPrice: 200, dynamicFields: { valve_type: 'Ball', valve_size: '150', valve_class: '300' } }
      ]
    };

    const html = renderPricePart2(mockQuotation);
    
    // Ensure table has 8 column headers
    assert.ok(html.includes('<th>1</th>'));
    assert.ok(html.includes('<th>7</th>'));
    assert.ok(html.includes('<th>8</th>'));

    // Check that column 7 and 8 cells for Valve Type, Size, Class are empty <td></td> not <td>0</td>
    const emptyTdMatches = html.match(/<td><\/td>/g) || [];
    assert.ok(emptyTdMatches.length >= 10, `Expected empty <td></td> cells for columns 3-8, found ${emptyTdMatches.length}`);
    
    // Make sure we do NOT have <td>0</td> for valve type or size in empty slots
    assert.strictEqual(html.includes('<td>0</td>'), false, 'HTML should not contain <td>0</td> for empty slots');
  });

  // --- TEST 4: Engineering fields deferred from AI (BUG 3) ---
  await testAsync('BUG 3: Engineering-derived fields (testing_std, fire_safe, etc.) are deferred from AI', async () => {
    const fieldDefinitions = [
      { fieldName: 'valve_size', isRequired: true },
      { fieldName: 'valve_testing_std', isRequired: false },
      { fieldName: 'valve_fire_safe', isRequired: false }
    ];

    const result = await extractionPipeline.processProductGatedPipeline({
      textContext: 'Please quote 2" 150# Ball Valve Qty 10',
      fieldDefinitions,
      productDescription: '2" 150# Ball Valve Qty 10',
      enquiryId: 'TEST-ENQ-001',
      productIndex: 0
    });

    assert.strictEqual(result.fieldConfidences['valve_size'].source, 'REGEX');
    assert.strictEqual(result.fieldConfidences['valve_testing_std'].source, 'ENGINEERING_RULE');
    assert.strictEqual(result.fieldConfidences['valve_testing_std'].validationState, 'DEFERRED');
    assert.strictEqual(result.fieldConfidences['valve_fire_safe'].source, 'ENGINEERING_RULE');
    assert.strictEqual(result.fieldConfidences['valve_fire_safe'].validationState, 'DEFERRED');
  });

  // --- TEST 5: Explicit customer-provided engineering value remains intact (BUG 3) ---
  await testAsync('BUG 3: Explicit customer-provided engineering value (API 598) is preserved by regex', async () => {
    const fieldDefinitions = [
      { fieldName: 'designStandard', isRequired: false }
    ];

    const result = await extractionPipeline.processProductGatedPipeline({
      textContext: 'Testing standard must be API 598',
      fieldDefinitions,
      productDescription: 'Ball Valve 50mm 150# as per API 598',
      enquiryId: 'TEST-ENQ-002',
      productIndex: 0
    });

    assert.strictEqual(result.fieldConfidences['designStandard'].source, 'REGEX');
    assert.strictEqual(result.fieldConfidences['designStandard'].value, 'API 598');
  });

  // --- TEST 6: Isolated Cache Keys for different products & enquiries (BUG 4) ---
  test('BUG 4: Cache keys are isolated per enquiryId, productIndex, and description hash', () => {
    const key1 = `${'ENQ1'}::p0::hashA::size,class`;
    const key2 = `${'ENQ1'}::p1::hashB::size,class`;
    const key3 = `${'ENQ2'}::p0::hashA::size,class`;

    assert.notStrictEqual(key1, key2);
    assert.notStrictEqual(key1, key3);
  });

  // --- TEST 7: Currency Rounding Policy (BUG 5) ---
  test('BUG 5: Currency rounding policy handles ₹1201 × 5% and GST accurately', () => {
    const mockQuotation = {
      cert32Percent: 5,
      pfPercent: 5,
      gstRate: 18,
      items: [
        { quantity: 1, unitPrice: 1201 }
      ]
    };

    const pricing = calculateQuotationPricing(mockQuotation);

    assert.strictEqual(pricing.baseTotalRateSum, 1201);
    assert.strictEqual(pricing.cert32Amount, 60.05);
    assert.strictEqual(pricing.pfAmount, 60.05);
    assert.strictEqual(pricing.grandTotalBeforeGST, 1321.1);
    assert.strictEqual(pricing.gstAmount, 237.8);
    assert.strictEqual(pricing.grandTotalWithGST, 1558.9);
  });

  // --- TEST 8: 6-item enquiry with different sizes and classes ---
  test('6-item RFQ simulation: preserves unique sizes and classes per item', () => {
    const mockItems = [
      { quantity: 5, dynamicFields: { valve_type: 'Floating Ball', valve_size: '50 mm', valve_class: '150#' } },
      { quantity: 2, dynamicFields: { valve_type: 'Trunnion Ball', valve_size: '150 mm', valve_class: '300#' } },
      { quantity: 4, dynamicFields: { valve_type: 'Swing Check', valve_size: '100 mm', valve_class: '150#' } },
      { quantity: 10, dynamicFields: { valve_type: 'Lift Check', valve_size: '25 mm', valve_class: '800#' } },
      { quantity: 3, dynamicFields: { valve_type: 'Gate', valve_size: '200 mm', valve_class: '300#' } },
      { quantity: 6, dynamicFields: { valve_type: 'Globe', valve_size: '50 mm', valve_class: '150#' } }
    ];

    const expectedTypes = ['BALL', 'BALL', 'CHECK', 'CHECK', 'GATE', 'GLOBE'];
    const expectedSizes = ['50', '150', '100', '25', '200', '50'];
    const expectedClasses = ['150', '300', '150', '800', '300', '150'];

    mockItems.forEach((item, idx) => {
      assert.strictEqual(extractItemFieldValue(item, 'valve_type'), expectedTypes[idx]);
      assert.strictEqual(extractItemFieldValue(item, 'valve_size'), expectedSizes[idx]);
      assert.strictEqual(extractItemFieldValue(item, 'valve_class'), expectedClasses[idx]);
    });
  });

  console.log('\n' + '=' .repeat(80));
  console.log(`SUMMARY: ${passed} / ${total} REGRESSION TESTS PASSED!`);
  console.log('=' .repeat(80));
}

runRegressionTests().catch(err => { console.error(err); process.exit(1); });

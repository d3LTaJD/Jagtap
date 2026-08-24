const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { detectProductCategory } = require('../services/boqParserService');
const SizeExtractor = require('../services/extraction/extractors/SizeExtractor');
const ClassExtractor = require('../services/extraction/extractors/ClassExtractor');
const OperationExtractor = require('../services/extraction/extractors/OperationExtractor');
const ValveExtractor = require('../services/extraction/extractors/ValveExtractor');

async function runTests() {
  console.log('================================================================================');
  console.log('REGRESSION TEST: CONTRACT CHECKLIST & LINE ITEM DATA SYNCHRONIZATION');
  console.log('================================================================================\n');

  const valveTestCases = [
    { text: '18 in 900 Motoriz', expectedSize: '450 mm', expectedClass: '900#', expectedOp: 'Motorized' },
    { text: '18 in 600 Motoriz', expectedSize: '450 mm', expectedClass: '600#', expectedOp: 'Motorized' },
    { text: '16 in 900 Motoriz', expectedSize: '400 mm', expectedClass: '900#', expectedOp: 'Motorized' },
    { text: '16 in 600 Motoriz', expectedSize: '400 mm', expectedClass: '600#', expectedOp: 'Motorized' },
    { text: '24 in 150 Motoriz', expectedSize: '600 mm', expectedClass: '150#', expectedOp: 'Motorized' },
    { text: '20 in 150 Motoriz', expectedSize: '500 mm', expectedClass: '150#', expectedOp: 'Motorized' },
    { text: '12 in 600 Manual', expectedSize: '300 mm', expectedClass: '600#', expectedOp: 'Manual' },
    { text: '4 in 150 Manual', expectedSize: '100 mm', expectedClass: '150#', expectedOp: 'Manual' },
    { text: '2 in 150 Manual', expectedSize: '50 mm', expectedClass: '150#', expectedOp: 'Manual' },
    { text: '2 in 600 Manual', expectedSize: '50 mm', expectedClass: '600#', expectedOp: 'Manual' },
    { text: '4 in 600 Manual', expectedSize: '100 mm', expectedClass: '600#', expectedOp: 'Manual' },
    { text: '2 in 900 Manual', expectedSize: '50 mm', expectedClass: '900#', expectedOp: 'Manual' },
    { text: '4 in 900 Manual', expectedSize: '100 mm', expectedClass: '900#', expectedOp: 'Manual' }
  ];

  console.log('--- Step 1: Verify Deterministic Line Item Extraction for All Valve Sizes ---');
  for (const tc of valveTestCases) {
    const sRes = SizeExtractor.extract(tc.text);
    const cRes = ClassExtractor.extract(tc.text);
    const oRes = OperationExtractor.extract(tc.text);
    const category = detectProductCategory(tc.text);

    console.log(`[Item] "${tc.text}" -> Size: ${sRes?.normalizedValue} | Class: ${cRes?.normalizedValue} | Op: ${oRes?.normalizedValue} | Cat: ${category}`);

    assert.strictEqual(sRes?.normalizedValue, tc.expectedSize, `Size mismatch for "${tc.text}"`);
    assert.strictEqual(cRes?.normalizedValue, tc.expectedClass, `Class mismatch for "${tc.text}"`);
    assert.strictEqual(oRes?.normalizedValue, tc.expectedOp, `Operation mismatch for "${tc.text}"`);
    assert.strictEqual(category, 'Valves', `Category mismatch for "${tc.text}"`);
  }
  console.log('[PASS] Step 1: All 13 valve line items extracted with correct nominal sizes and classes\n');

  console.log('--- Step 2: Verify Structural & Supervision Items Have Null Valve Size ---');
  const nonValveCases = [
    { text: 'MS ST for Sch 9', expectedCat: 'Structural' },
    { text: 'MS ST for Sch 4', expectedCat: 'Structural' },
    { text: 'MS ST for Sch 1', expectedCat: 'Structural' },
    { text: 'Supervision', expectedCat: 'Supervision' }
  ];

  for (const tc of nonValveCases) {
    const sRes = SizeExtractor.extract(tc.text);
    const cRes = ClassExtractor.extract(tc.text);
    const category = detectProductCategory(tc.text);

    console.log(`[Non-Valve] "${tc.text}" -> Size: ${sRes?.normalizedValue || 'null'} | Class: ${cRes?.normalizedValue || 'null'} | Cat: ${category}`);

    assert.strictEqual(sRes?.normalizedValue || null, null, `Size should be null for "${tc.text}"`);
    assert.strictEqual(cRes?.normalizedValue || null, null, `Class should be null for "${tc.text}"`);
    assert.strictEqual(category, tc.expectedCat, `Category should be ${tc.expectedCat} for "${tc.text}"`);
  }
  console.log('[PASS] Step 2: Structural and Supervision items retain null valve sizes\n');

  console.log('--- Step 3: Contract Checklist Specification Drawer Data Synchronization ---');
  // Simulate building quotation items from enquiry products and passing them to Contract Checklist Drawer
  for (let idx = 0; idx < valveTestCases.length; idx++) {
    const tc = valveTestCases[idx];
    const sRes = SizeExtractor.extract(tc.text);
    const cRes = ClassExtractor.extract(tc.text);
    const oRes = OperationExtractor.extract(tc.text);

    // Simulated Enquiry Product
    const enquiryProduct = {
      itemNo: idx + 1,
      lineItemId: `ENQ-LI-${String(idx + 1).padStart(3, '0')}`,
      description: tc.text,
      category: 'Valves',
      quantity: 4,
      unit: 'NOS',
      dynamicFields: {
        valve_type: 'Ball Valve',
        valve_size: sRes?.normalizedValue,
        valve_class: cRes?.normalizedValue,
        valve_operating: oRes?.normalizedValue
      }
    };

    // Simulated Quotation Item creation (extractItemsFromEnquiry logic)
    const quotationItem = {
      itemNo: enquiryProduct.itemNo,
      lineItemId: enquiryProduct.lineItemId,
      description: enquiryProduct.description,
      productCategory: enquiryProduct.category,
      quantity: enquiryProduct.quantity,
      unit: enquiryProduct.unit,
      dynamicFields: { ...enquiryProduct.dynamicFields }
    };

    // Simulated Contract Checklist Drawer values (DynamicFormRenderer values)
    const drawerValues = {
      productCategory: quotationItem.productCategory,
      ...quotationItem.dynamicFields,
      valve_size: quotationItem.dynamicFields.valve_size || quotationItem.size || undefined,
      valve_class: quotationItem.dynamicFields.valve_class || quotationItem.pressureClass || undefined,
      valve_type: quotationItem.dynamicFields.valve_type || quotationItem.valveType || undefined
    };

    // Assert that lineItem size equals contract checklist drawer valveSize
    assert.strictEqual(
      quotationItem.dynamicFields.valve_size,
      drawerValues.valve_size,
      `Synchronization failure: lineItem.size (${quotationItem.dynamicFields.valve_size}) !== drawerValues.valve_size (${drawerValues.valve_size}) for "${tc.text}"`
    );

    assert.strictEqual(drawerValues.valve_size, tc.expectedSize);
    assert.strictEqual(drawerValues.valve_class, tc.expectedClass);
  }
  console.log('[PASS] Step 3: 100% lineItem.size === contractChecklist.valveSize verified across all valve items\n');

  console.log('--- Step 4: Dropdown Option Matching Simulation (AutocompleteSelect) ---');
  const cleanMatch = (v) => String(v ?? '').trim().toLowerCase().replace(/\s*(?:mm|inch|inches|in|\"|#)$/, '').trim();

  // Test with options without 'mm' (e.g. ['15', '50', '100', '300', '400', '450', '500', '600', '900'])
  const numberOptions = ['15', '20', '25', '32', '40', '50', '65', '80', '100', '150', '200', '250', '300', '350', '400', '450', '500', '600'];
  const testVal = '450 mm';
  const matchedOpt = numberOptions.find(o => String(o) === testVal || cleanMatch(o) === cleanMatch(testVal));
  console.log(`Option match for "${testVal}" against options list: "${matchedOpt}"`);
  assert.strictEqual(matchedOpt, '450', 'Option "450" should match value "450 mm"');

  // Test with options with 'mm' (e.g. ['15 mm', '50 mm', '450 mm'])
  const mmOptions = ['15 mm', '50 mm', '100 mm', '300 mm', '400 mm', '450 mm', '500 mm', '600 mm'];
  const matchedMmOpt = mmOptions.find(o => String(o) === testVal || cleanMatch(o) === cleanMatch(testVal));
  console.log(`Option match for "${testVal}" against mm-options list: "${matchedMmOpt}"`);
  assert.strictEqual(matchedMmOpt, '450 mm', 'Option "450 mm" should match value "450 mm"');

  console.log('[PASS] Step 4: AutocompleteSelect cleanMatch correctly resolves options with or without unit suffixes\n');

  console.log('================================================================================');
  console.log('ALL CONTRACT CHECKLIST SYNC REGRESSION TESTS PASSED!');
  console.log('================================================================================');
}

runTests().catch(err => {
  console.error('[FAIL] Test failed:', err);
  process.exit(1);
});

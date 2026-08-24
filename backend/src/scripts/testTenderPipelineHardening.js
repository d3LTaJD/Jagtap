const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { detectProductCategory } = require('../services/boqParserService');
const ClassExtractor = require('../services/extraction/extractors/ClassExtractor');
const SizeExtractor = require('../services/extraction/extractors/SizeExtractor');
const OperationExtractor = require('../services/extraction/extractors/OperationExtractor');
const aiConfig = require('../config/aiConfig');

async function runTests() {
  console.log('================================================================================');
  console.log('VERIFYING TENDER / BOQ PIPELINE HARDENING');
  console.log('================================================================================\n');

  // Test 1: Category Detection
  console.log('--- Test 1: Product Category Detection ---');
  assert.strictEqual(detectProductCategory('MS ST for Sch 4'), 'Structural', 'MS ST should be categorized as Structural');
  assert.strictEqual(detectProductCategory('MS ST for Sch 1'), 'Structural', 'MS ST should be categorized as Structural');
  assert.strictEqual(detectProductCategory('MS ST for Sch 9'), 'Structural', 'MS ST should be categorized as Structural');
  assert.strictEqual(detectProductCategory('Supervision'), 'Supervision', 'Supervision should be categorized as Supervision');
  assert.strictEqual(detectProductCategory('2 in 150 Manual'), 'Valves', '2 in 150 Manual should be categorized as Valves');
  assert.strictEqual(detectProductCategory('4 in 150 Motoriz'), 'Valves', '4 in 150 Motoriz should be categorized as Valves');
  assert.strictEqual(detectProductCategory('API 6D Ball Valve 2IN 300#'), 'Valves', 'Ball valve should be categorized as Valves');
  console.log('[PASS] Test 1: Category detection accurately distinguishes structural, supervision, and valves\n');

  // Test 2: Shorthand Line Item Extraction for various nominal sizes and operations
  console.log('--- Test 2: Shorthand Line Item Extraction ---');
  const sizeExt = SizeExtractor;
  const classExt = ClassExtractor;
  const opExt = OperationExtractor;

  const testCases = [
    { text: '2 in 150 Manual', expectedSize: '50 mm', expectedClass: '150#', expectedOp: 'Manual' },
    { text: '4 in 150 Manual', expectedSize: '100 mm', expectedClass: '150#', expectedOp: 'Manual' },
    { text: '2 in 600 Manual', expectedSize: '50 mm', expectedClass: '600#', expectedOp: 'Manual' },
    { text: '4 in 150 Motoriz', expectedSize: '100 mm', expectedClass: '150#', expectedOp: 'Motorized' },
    { text: '12 in 600 Manual', expectedSize: '300 mm', expectedClass: '600#', expectedOp: 'Manual' },
    { text: '16 in 900 Motoriz', expectedSize: '400 mm', expectedClass: '900#', expectedOp: 'Motorized' },
    { text: '18 in 600 Motoriz', expectedSize: '450 mm', expectedClass: '600#', expectedOp: 'Motorized' },
    { text: '20 in 150 Motoriz', expectedSize: '500 mm', expectedClass: '150#', expectedOp: 'Motorized' },
    { text: '24 in 150 Motoriz', expectedSize: '600 mm', expectedClass: '150#', expectedOp: 'Motorized' },
    { text: 'MS ST for Sch 4', expectedSize: null, expectedClass: null, expectedOp: 'Manual' },
    { text: 'MS ST for Sch 1', expectedSize: null, expectedClass: null, expectedOp: 'Manual' },
  ];

  for (const tc of testCases) {
    const sRes = sizeExt.extract(tc.text);
    const cRes = classExt.extract(tc.text);
    const oRes = opExt.extract(tc.text);

    console.log(`Testing: "${tc.text}"`);
    console.log(`  -> Size: ${sRes?.normalizedValue || 'null'} | Class: ${cRes?.normalizedValue || 'null'} | Op: ${oRes?.normalizedValue || 'null'}`);

    assert.strictEqual(sRes?.normalizedValue || null, tc.expectedSize, `Size mismatch for "${tc.text}"`);
    assert.strictEqual(cRes?.normalizedValue || null, tc.expectedClass, `Class mismatch for "${tc.text}"`);
    if (tc.expectedOp && !tc.text.startsWith('MS ST')) {
      assert.strictEqual(oRes?.normalizedValue || null, tc.expectedOp, `Operation mismatch for "${tc.text}"`);
    }
  }
  console.log('[PASS] Test 2: All shorthand valve and structural items extracted with exact nominal sizes and classes\n');

  // Test 3: AI Config Gemini Models
  console.log('--- Test 3: Gemini Fallback Chain Configuration ---');
  console.log('Configured Gemini Models:', aiConfig.GEMINI_MODELS);
  assert(!aiConfig.GEMINI_MODELS.includes('gemini-2.0-flash'), 'Deprecated gemini-2.0-flash must be removed');
  assert(!aiConfig.GEMINI_MODELS.includes('gemini-1.5-flash'), 'Shutdown gemini-1.5-flash must be removed');
  assert.deepStrictEqual(aiConfig.GEMINI_MODELS, ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash']);
  console.log('[PASS] Test 3: Gemini fallback chain configured exactly to [gemini-3.6-flash, gemini-3.5-flash-lite, gemini-2.5-flash]\n');

  console.log('================================================================================');
  console.log('ALL TENDER / BOQ HARDENING TESTS PASSED!');
  console.log('================================================================================');
}

runTests().catch(err => {
  console.error('[FAIL] Test failed:', err);
  process.exit(1);
});

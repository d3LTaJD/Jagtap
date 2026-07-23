/**
 * Comprehensive Parameterized Regression Test Matrix
 * Verifies that all size variations (1/2", 3/4", 1", 2", 4", 6", 8", 10", DN50, 50 mm, 50mm)
 * paired across all industrial valve types (Ball Valve, Globe Valve, Gate Valve, Check Valve, Butterfly Valve, Plug Valve, Control Valve)
 * extract deterministically to the correct canonical size (DN in mm).
 */

require('dotenv').config();
const extractionPipeline = require('../services/extraction/ExtractionPipeline');
const normalizationService = require('../services/extraction/NormalizationService');

function assertEqual(actual, expected, testName) {
  if (actual === expected) {
    console.log(`  ✅ [PASS] ${testName}`);
    return true;
  } else {
    console.error(`  ❌ [FAIL] ${testName}: Expected "${expected}", got "${actual}"`);
    process.exitCode = 1;
    return false;
  }
}

const SIZE_MATRIX = [
  { input: '1/2"', expected: '15' },
  { input: '3/4"', expected: '20' },
  { input: '1"', expected: '25' },
  { input: '2"', expected: '50' },
  { input: '4"', expected: '100' },
  { input: '6"', expected: '150' },
  { input: '8"', expected: '200' },
  { input: '10"', expected: '250' },
  { input: 'DN50', expected: '50' },
  { input: '50 mm', expected: '50' },
  { input: '50mm', expected: '50' }
];

const VALVE_TYPES = [
  'Ball Valve',
  'Globe Valve',
  'Gate Valve',
  'Check Valve',
  'Butterfly Valve',
  'Plug Valve',
  'Control Valve'
];

console.log('================================================================');
console.log('   PARAMETRIZED VALVE EXTRACTION & NORMALIZATION REGRESSION MATRIX');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

// 1. Direct NormalizationService Matrix Test
console.log('1. Testing NormalizationService.normalizeField Matrix...');
SIZE_MATRIX.forEach(({ input, expected }) => {
  totalTests += 1;
  const result = normalizationService.normalizeField('valve_size', input);
  if (assertEqual(result, expected, `NormalizationService.normalizeField('${input}') -> '${expected}'`)) {
    passedTests += 1;
  }
});

// 2. Full ExtractionPipeline Valve Matrix Test
console.log('\n2. Testing ExtractionPipeline across all Valve Types and Size Formats...');
VALVE_TYPES.forEach(type => {
  console.log(`\n--- Valve Type: [${type}] ---`);
  SIZE_MATRIX.forEach(({ input, expected }) => {
    totalTests += 1;
    const lineText = `Item 01: Supply of ${input} ${type}, 300# Flanged`;
    const res = extractionPipeline.processDocument(lineText, {
      documentId: `TEST-${type.replace(/\s+/g, '')}-${expected}`,
      documentType: 'PURCHASE_RFQ'
    });

    const sizeVal = res.legacySpecifications.valve_size;
    const typeVal = res.legacySpecifications.valve_type;

    const sizeOk = assertEqual(sizeVal, expected, `${type} with size '${input}' -> Extracted Size '${expected}'`);
    const typeOk = assertEqual(typeVal, type, `${type} with size '${input}' -> Extracted Type '${type}'`);

    if (sizeOk && typeOk) passedTests += 1;
  });
});

console.log('\n================================================================');
console.log(`  RESULTS SUMMARY: ${passedTests}/${totalTests} Parameterized Tests Passed cleanly!`);
if (passedTests === totalTests) {
  console.log('  🎯 ALL PARAMETRIZED REGRESSION MATRIX TESTS PASSED PERFECTLY!');
} else {
  console.error('  ⚠️ SOME MATRIX TESTS FAILED!');
  process.exitCode = 1;
}
console.log('================================================================\n');

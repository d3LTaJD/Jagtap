/**
 * Comprehensive Automated Test Suite for Zero-Hallucination Engineering Extraction Architecture.
 */

const mongoose = require('mongoose');
require('dotenv').config();

const engineeringDictionary = require('../services/extraction/EngineeringDictionary');
const validationEngine = require('../services/extraction/ValidationEngine');
const fieldConfidenceEngine = require('../services/extraction/FieldConfidenceEngine');
const extractionPipeline = require('../services/extraction/ExtractionPipeline');
const extractorRegistry = require('../services/extraction/ExtractorRegistry');

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 RUNNING ZERO-HALLUCINATION ENGINEERING EXTRACTION TEST SUITE');
  console.log('===============================================================\n');

  let passedCount = 0;
  let totalCount = 0;

  function assert(condition, message) {
    totalCount++;
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Full Pipeline - "BALL API6D TRUNNION 4IN CL300 WCB"
  // -------------------------------------------------------------
  console.log('--- TEST 1: Complex RFQ string extraction ---');
  const input1 = "BALL API6D TRUNNION 4IN CL300 WCB";
  const regexRes1 = extractorRegistry.runAll(input1);

  assert(regexRes1.ValveExtractor?.normalizedValue === 'Ball Valve', 'Extracted Valve Type = Ball Valve');
  assert(regexRes1.SizeExtractor?.normalizedValue === '100 mm', 'Extracted Size = 100 mm (from 4IN)');
  assert(regexRes1.ClassExtractor?.normalizedValue === '300#', 'Extracted Class = 300# (from CL300)');
  assert(regexRes1.MaterialExtractor?.normalizedValue === 'ASTM A216 WCB', 'Extracted Material = ASTM A216 WCB (from WCB)');

  // -------------------------------------------------------------
  // TEST 2: Zero-Hallucination - "Valve required"
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Bare prompt (Zero-Hallucination) ---');
  const input2 = "Valve required";
  const regexRes2 = extractorRegistry.runAll(input2);

  assert(regexRes2.SizeExtractor === null || regexRes2.SizeExtractor?.normalizedValue === null, 'Size is NULL for bare input');
  assert(regexRes2.ClassExtractor === null || regexRes2.ClassExtractor?.normalizedValue === null, 'Class is NULL for bare input');
  assert(regexRes2.MaterialExtractor === null || regexRes2.MaterialExtractor?.normalizedValue === null, 'Material is NULL for bare input');

  // -------------------------------------------------------------
  // TEST 3: Validation Engine Rejection - "CL3000"
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Invalid pressure class rejection ---');
  const valRes3 = validationEngine.validateField('valve_class', 'CL3000');

  assert(valRes3.state === 'INVALID', 'Class "CL3000" rejected by Validation Engine');
  assert(valRes3.canonicalValue === null, 'Canonical value for "CL3000" is NULL');

  // -------------------------------------------------------------
  // TEST 4: Forwarded RFQ Valve Type - "Gate Valve 8\" Class 150 Qty 20"
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Forwarded RFQ Gate Valve classification ---');
  const input4 = "Forwarded RFQ: Please quote 8\" Gate Valve Class 150 Qty 20";
  const regexRes4 = extractorRegistry.runAll(input4);

  assert(regexRes4.ValveExtractor?.normalizedValue === 'Gate Valve', 'Correctly identified Gate Valve (not overwritten to Ball Valve)');
  assert(regexRes4.SizeExtractor?.normalizedValue === '200 mm', 'Extracted Size = 200 mm (8")');
  assert(regexRes4.ClassExtractor?.normalizedValue === '150#', 'Extracted Class = 150#');

  // -------------------------------------------------------------
  // TEST 5: Supply Ball Valve (No guessing size or class)
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: "Supply Ball Valve" (Must not guess size/class) ---');
  const input5 = "Supply Ball Valve";
  const regexRes5 = extractorRegistry.runAll(input5);

  assert(regexRes5.ValveExtractor?.normalizedValue === 'Ball Valve', 'Identified Ball Valve');
  assert(regexRes5.SizeExtractor === null || regexRes5.SizeExtractor?.normalizedValue === null, 'Size is NULL (not guessed)');
  assert(regexRes5.ClassExtractor === null || regexRes5.ClassExtractor?.normalizedValue === null, 'Class is NULL (not guessed)');

  // -------------------------------------------------------------
  // TEST 6: Field Confidence Engine Scoring & Gating
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Field Confidence Engine Scoring ---');
  const conf1 = fieldConfidenceEngine.calculateFieldConfidence({
    fieldName: 'valve_size',
    rawValue: '4IN',
    normalizedValue: '100 mm',
    extractionMethod: 'REGEX',
    validationState: 'VALID'
  });
  assert(conf1.confidence === 95, 'Regex normalized size gets 95% confidence');

  const conf2 = fieldConfidenceEngine.calculateFieldConfidence({
    fieldName: 'valve_class',
    rawValue: '3000',
    normalizedValue: null,
    extractionMethod: 'AI',
    validationState: 'INVALID'
  });
  assert(conf2.confidence === 0, 'Invalid class gets 0% confidence');

  const statusEval = fieldConfidenceEngine.evaluateProductStatus({
    valve_type: { confidence: 100, validationState: 'VALID' },
    valve_size: { confidence: 95, validationState: 'VALID' },
    valve_class: { confidence: 0, validationState: 'INVALID' }
  });
  assert(statusEval.status === 'needs_review', 'Product marked "needs_review" when a field fails validation');

  // -------------------------------------------------------------
  // TEST SUMMARY
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`📊 TEST RESULTS: ${passedCount} / ${totalCount} PASSED`);
  console.log('===============================================================\n');

  if (passedCount === totalCount) {
    console.log('🎉 ALL ZERO-HALLUCINATION TEST CASES PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('❌ SOME TEST CASES FAILED.');
    process.exit(1);
  }
}

runTests();

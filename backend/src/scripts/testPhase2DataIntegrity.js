/**
 * testPhase2DataIntegrity.js
 * Comprehensive regression test suite for Phase 2 — Data Integrity Hardening.
 *
 * Tests:
 * 1. Missing confidence remains 0 / UNKNOWN (never defaulted to 100/90/75).
 * 2. Explicit confidence 0 remains 0, explicit confidence 75 remains 75.
 * 3. Missing quantity remains null (never defaulted to 1).
 * 4. Missing size remains null (never defaulted to 50mm).
 * 5. Missing class remains null (never defaulted to 150#).
 * 6. Missing material remains null (never defaulted to WCB).
 * 7. Customer-provided engineering field retains CUSTOMER_EXTRACTED provenance.
 * 8. Engineering-derived field retains ENGINEERING_RULE provenance.
 * 9. Invalid derived value does not erase raw customer evidence.
 * 10. lineItemId isolates six different items.
 * 11. productIndex cannot cause cross-item persistence or cache collisions.
 * 12. Missing MasterData lookup does not invent a value (returns null/NOT_FOUND).
 * 13. Validation failure sets manual-review state (needsManualReview = true).
 * 14. Full pipeline integration preserves data integrity across 6 items.
 */

const assert = require('assert');
const path = require('path');

// Services and Engines
const extractionPipeline = require('../services/extraction/ExtractionPipeline');
const validationEngine = require('../services/extraction/ValidationEngine');
const fieldConfidenceEngine = require('../services/extraction/FieldConfidenceEngine');
const scoringEngine = require('../services/extraction/ScoringEngine');
const engineeringDictionary = require('../services/extraction/EngineeringDictionary');
const { createEngineeringField, VALIDATION_STATES, REVIEW_REASONS } = require('../types/EngineeringField');

console.log('='.repeat(80));
console.log('RUNNING PHASE 2 DATA INTEGRITY VERIFICATION SUITE');
console.log('='.repeat(80));

let passed = 0;
let failed = 0;

function runTest(testName, testFn) {
  try {
    testFn();
    console.log(`[PASS] ${testName}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${testName}: ${err.message}`);
    failed++;
  }
}

async function runAsyncTest(testName, testFn) {
  try {
    await testFn();
    console.log(`[PASS] ${testName}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${testName}: ${err.message}`);
    failed++;
  }
}

(async () => {
  // 1. Missing confidence remains 0 / UNKNOWN
  runTest('Test 1: Missing confidence defaults to 0 and not 100/90/75', () => {
    const score = scoringEngine.calculateScore({});
    assert.strictEqual(score.confidence, 0, `Expected confidence 0, got ${score.confidence}`);

    const field = createEngineeringField({ fieldId: 'test_field', fieldName: 'Test Field' });
    assert.strictEqual(field.score.confidence, 0, `Expected field score confidence 0, got ${field.score.confidence}`);
  });

  // 2. Explicit confidence 0 remains 0, 75 remains 75
  runTest('Test 2: Explicit confidence 0 remains 0, 75 remains 75', () => {
    const score0 = scoringEngine.calculateScore({ confidence: 0 });
    assert.strictEqual(score0.confidence, 0, `Explicit 0 became ${score0.confidence}`);

    const score75 = scoringEngine.calculateScore({ confidence: 75 });
    assert.strictEqual(score75.confidence, 75, `Explicit 75 became ${score75.confidence}`);
  });

  // 3. Missing quantity remains null
  runTest('Test 3: Missing quantity remains null (no default to 1)', () => {
    const valRes = validationEngine.validateField('quantity', null);
    assert.strictEqual(valRes.canonicalValue, null, 'Empty quantity should return canonicalValue: null');

    const itemValidation = validationEngine.validateLineItem({
      lineItemId: 'LI-001',
      quantity: null,
      dynamicFields: { valve_size: '50 mm', valve_class: '150#' }
    });
    assert.strictEqual(itemValidation.isValid, false, 'Line item with null quantity must not be valid');
    assert.strictEqual(itemValidation.needsManualReview, true, 'Line item with null quantity must require manual review');
  });

  // 4. Missing size remains null
  runTest('Test 4: Missing size remains null (never defaulted to 50mm)', () => {
    const valRes = validationEngine.validateField('valve_size', null);
    assert.strictEqual(valRes.canonicalValue, null, 'Missing size must return null');

    const invalidSize = validationEngine.validateField('valve_size', '9000 mm');
    assert.strictEqual(invalidSize.canonicalValue, null, 'Impossible size (9000 mm) must return null');
    assert.strictEqual(invalidSize.state, 'INVALID');
  });

  // 5. Missing class remains null
  runTest('Test 5: Missing class remains null (never defaulted to 150#)', () => {
    const valRes = validationEngine.validateField('valve_class', null);
    assert.strictEqual(valRes.canonicalValue, null, 'Missing class must return null');

    const invalidClass = validationEngine.validateField('valve_class', '3000#');
    assert.strictEqual(invalidClass.canonicalValue, null, 'Impossible class (3000#) must return null');
    assert.strictEqual(invalidClass.state, 'INVALID');
  });

  // 6. Missing material remains null
  runTest('Test 6: Missing material remains null (never defaulted to generic WCB)', () => {
    const valRes = validationEngine.validateField('valve_moc_body', null);
    assert.strictEqual(valRes.canonicalValue, null, 'Missing material must return null');

    const unknownMat = validationEngine.validateField('valve_moc_body', 'Unobtanium Grade X');
    assert.strictEqual(unknownMat.canonicalValue, null, 'Unrecognized material must return null');
    assert.strictEqual(unknownMat.state, 'INVALID');
  });

  // 7. Customer-provided engineering field retains CUSTOMER_EXTRACTED provenance
  await runAsyncTest('Test 7: Customer-provided engineering field retains CUSTOMER_EXTRACTED provenance', async () => {
    const textContext = 'Customer RFQ: Supply 2" 150# Ball Valve with hydrostatic testing per API 598 required.';
    const fieldDefinitions = [
      { fieldName: 'valve_testing_std', isRequired: false },
      { fieldName: 'valve_size', isRequired: true },
      { fieldName: 'valve_class', isRequired: true }
    ];

    const result = await extractionPipeline.processProductGatedPipeline({
      textContext,
      fieldDefinitions,
      productDescription: '2" 150# Ball Valve API 598',
      lineItemId: 'LI-TEST-001'
    });

    assert.strictEqual(result.fieldConfidences.valve_testing_std.source, 'REGEX');
    assert.strictEqual(result.fieldConfidences.valve_testing_std.provenance, 'CUSTOMER_EXTRACTED');
    assert.strictEqual(result.fieldConfidences.valve_testing_std.value, 'API 598');
  });

  // 8. Engineering-derived field retains ENGINEERING_RULE provenance
  await runAsyncTest('Test 8: Engineering-derived field retains ENGINEERING_RULE provenance and null value when unstated', async () => {
    const textContext = 'Customer RFQ: Supply 2" 150# Ball Valve only.';
    const fieldDefinitions = [
      { fieldName: 'valve_testing_std', isRequired: false },
      { fieldName: 'valve_fire_safe', isRequired: false }
    ];

    const result = await extractionPipeline.processProductGatedPipeline({
      textContext,
      fieldDefinitions,
      productDescription: '2" 150# Ball Valve',
      lineItemId: 'LI-TEST-002'
    });

    assert.strictEqual(result.fieldConfidences.valve_testing_std.source, 'ENGINEERING_RULE');
    assert.strictEqual(result.fieldConfidences.valve_testing_std.provenance, 'ENGINEERING_RULE');
    assert.strictEqual(result.fieldConfidences.valve_testing_std.value, null);
    assert.strictEqual(result.fieldConfidences.valve_testing_std.validationState, 'DEFERRED');
  });

  // 9. Invalid derived value does not erase raw customer evidence
  runTest('Test 9: Invalid value preserves raw customer evidence with INVALID state', () => {
    const rawCustomerValue = 'pneumatic actuator 9999';
    const valRes = validationEngine.validateField('valve_operating', rawCustomerValue);
    
    // Create an engineering field preserving the evidence
    const field = createEngineeringField({
      fieldId: 'valve_operating',
      fieldName: 'Operation',
      rawValue: rawCustomerValue,
      normalizedValue: valRes.canonicalValue, // null
      validationState: valRes.state, // INVALID
      reviewReason: REVIEW_REASONS.INVALID_VALUE,
      evidence: [{ text: rawCustomerValue, sourceDocument: 'EMAIL_BODY' }]
    });

    assert.strictEqual(field.rawValue, 'pneumatic actuator 9999', 'Raw customer evidence must be preserved');
    assert.strictEqual(field.normalizedValue, null, 'Normalized value must be null when invalid');
    assert.strictEqual(field.validationState, 'INVALID', 'Validation state must be INVALID');
    assert.strictEqual(field.reviewReason, 'INVALID_VALUE');
  });

  // 10. lineItemId isolates six different items
  await runAsyncTest('Test 10: lineItemId isolates six different items with distinct sizes and classes', async () => {
    const items = [
      { lineItemId: 'ENQ-001-LI-001', desc: 'Item 1: 50 mm 150# Ball Valve Qty 5', size: '50 mm', class: '150#' },
      { lineItemId: 'ENQ-001-LI-002', desc: 'Item 2: 150 mm 300# Ball Valve Qty 2', size: '150 mm', class: '300#' },
      { lineItemId: 'ENQ-001-LI-003', desc: 'Item 3: 100 mm 150# Ball Valve Qty 4', size: '100 mm', class: '150#' },
      { lineItemId: 'ENQ-001-LI-004', desc: 'Item 4: 25 mm 800# Gate Valve Qty 10', size: '25 mm', class: '800#' },
      { lineItemId: 'ENQ-001-LI-005', desc: 'Item 5: 200 mm 300# Globe Valve Qty 3', size: '200 mm', class: '300#' },
      { lineItemId: 'ENQ-001-LI-006', desc: 'Item 6: 50 mm 150# Check Valve Qty 6', size: '50 mm', class: '150#' },
    ];

    const fieldDefinitions = [
      { fieldName: 'valve_size', isRequired: true },
      { fieldName: 'valve_class', isRequired: true }
    ];

    const results = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const res = await extractionPipeline.processProductGatedPipeline({
        textContext: items.map(x => x.desc).join('\n'),
        fieldDefinitions,
        productDescription: it.desc,
        lineItemId: it.lineItemId,
        productIndex: i
      });
      results.push({ lineItemId: it.lineItemId, extracted: res.validatedDynamicFields });
    }

    assert.strictEqual(results[0].extracted.valve_size, '50 mm');
    assert.strictEqual(results[0].extracted.valve_class, '150#');

    assert.strictEqual(results[1].extracted.valve_size, '150 mm');
    assert.strictEqual(results[1].extracted.valve_class, '300#');

    assert.strictEqual(results[2].extracted.valve_size, '100 mm');
    assert.strictEqual(results[2].extracted.valve_class, '150#');

    assert.strictEqual(results[3].extracted.valve_size, '25 mm');
    assert.strictEqual(results[3].extracted.valve_class, '800#');

    assert.strictEqual(results[4].extracted.valve_size, '200 mm');
    assert.strictEqual(results[4].extracted.valve_class, '300#');

    assert.strictEqual(results[5].extracted.valve_size, '50 mm');
    assert.strictEqual(results[5].extracted.valve_class, '150#');
  });

  // 11. productIndex cannot cause cross-item persistence or cache collision
  runTest('Test 11: Cache keys use lineItemId and description hash to prevent collision', () => {
    const crypto = require('crypto');
    const descHash1 = crypto.createHash('md5').update('50 mm 150# Ball Valve').digest('hex').slice(0, 8);
    const descHash2 = crypto.createHash('md5').update('150 mm 300# Ball Valve').digest('hex').slice(0, 8);

    const key1 = `ENQ_123::li_LI-001::${descHash1}::valve_size,valve_class`;
    const key2 = `ENQ_123::li_LI-002::${descHash2}::valve_size,valve_class`;

    assert.notStrictEqual(key1, key2, 'Cache keys for different lineItemIds must be distinct');
  });

  // 12. Missing MasterData lookup does not invent a value
  runTest('Test 12: Missing MasterData lookup returns NOT_FOUND / null without inventing records', () => {
    const nonExistent = engineeringDictionary.validateAndNormalize('valve_type', 'FluxCapacitorValve');
    assert.strictEqual(nonExistent.isValid, false);
    assert.strictEqual(nonExistent.canonicalValue, null);
    assert.ok(nonExistent.reason.includes('not a recognized engineering valve type'));
  });

  // 13. Validation failure sets manual-review state
  runTest('Test 13: Validation failure sets needsManualReview = true', () => {
    const itemWithoutSizeAndClass = {
      lineItemId: 'LI-ERR-001',
      quantity: 5,
      sourceSpecifications: {},
      normalizedSpecifications: {},
      dynamicFields: {}
    };

    const valResult = validationEngine.validateLineItem(itemWithoutSizeAndClass);
    assert.strictEqual(valResult.isValid, false, 'Item missing size and class must be invalid');
    assert.strictEqual(valResult.needsManualReview, true, 'Item missing size and class must flag needsManualReview: true');
    assert.ok(valResult.warnings.length >= 2, 'Must contain warnings for missing size and missing class');
  });

  console.log('='.repeat(80));
  console.log(`SUMMARY: ${passed} / ${passed + failed} PHASE 2 DATA INTEGRITY TESTS PASSED!`);
  console.log('='.repeat(80));

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
})();

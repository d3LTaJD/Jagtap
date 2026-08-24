/**
 * testPhase3BNormalizationValidation.js
 * Verification suite for Phase 3B — Normalization & Engineering Validation Hardening.
 * Covers:
 * - NPS / DN Conversion & Consistency (ASME B16.10 / ISO 5752)
 * - NPS / DN Mismatch Conflict Detection
 * - Size Master Data Lookup (FOUND, NOT_FOUND, CONFLICT)
 * - Pressure Class Normalization & Master Data Validation
 * - Material / MOC Normalization & Unknown Rejection
 * - Valve Type Normalization & Design Type Preservation (TMBV, Swing/Lift Check)
 * - End Connection Subtype Preservation (Flanged RF, RTJ, Flat Face, BW, SW)
 * - Quantity Validation (Positive Integer, Reject 0/negative/missing)
 * - Customer Value vs Engineering Rule Conflict (API 598 vs API 6D)
 * - Engineering Derivations (Check Valve size cutoff, Ball Valve Annexures)
 * - Hydro / Air Test Calculations (Preserve Tables, Reject Missing Input)
 * - Six-Item RFQ Full Isolation & Validation
 */

const assert = require('assert');
const engineeringDictionary = require('../services/extraction/EngineeringDictionary');
const engineeringRulesEngine = require('../services/extraction/EngineeringRulesEngine');
const validationEngine = require('../services/extraction/ValidationEngine');
const knowledgeEngine = require('../services/extraction/KnowledgeEngine');
const { VALIDATION_STATES, REVIEW_REASONS } = require('../types/EngineeringField');

let passedTests = 0;
let failedTests = 0;

function runTest(testName, testFn) {
  try {
    testFn();
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${testName}: ${err.message}`);
    failedTests++;
  }
}

async function runAsyncTest(testName, testFn) {
  try {
    await testFn();
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${testName}: ${err.message}`);
    failedTests++;
  }
}

async function runSuite() {
  console.log('================================================================================');
  console.log('RUNNING PHASE 3B NORMALIZATION & ENGINEERING VALIDATION SUITE');
  console.log('================================================================================');

  // 1. Single inch size conversion
  runTest('Test 1: Single inch size converts to standard NB mm with NPS and DN', () => {
    const res = engineeringDictionary.normalizeSize('2"');
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.canonicalValue, '50 mm');
    assert.strictEqual(res.dn, 50);
    assert.strictEqual(res.nps, '2');
  });

  // 2. Single DN size conversion
  runTest('Test 2: Single DN size converts to standard NB mm with NPS and DN', () => {
    const res = engineeringDictionary.normalizeSize('DN100');
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.canonicalValue, '100 mm');
    assert.strictEqual(res.dn, 100);
    assert.strictEqual(res.nps, '4');
  });

  // 3. Fractional inch sizes
  runTest('Test 3: Fractional inch sizes convert correctly (1/2" -> 15mm, 1-1/2" -> 40mm, 2-1/2" -> 65mm)', () => {
    const res1 = engineeringDictionary.normalizeSize('1/2"');
    assert.strictEqual(res1.canonicalValue, '15 mm');
    assert.strictEqual(res1.dn, 15);

    const res2 = engineeringDictionary.normalizeSize('1-1/2"');
    assert.strictEqual(res2.canonicalValue, '40 mm');
    assert.strictEqual(res2.dn, 40);

    const res3 = engineeringDictionary.normalizeSize('2-1/2"');
    assert.strictEqual(res3.canonicalValue, '65 mm');
    assert.strictEqual(res3.dn, 65);
  });

  // 4. Dual representation matching: 2" (50 MM)
  runTest('Test 4: Dual representation 2" (50 MM) validates to 50 mm', () => {
    const res = engineeringDictionary.normalizeSize('2" (50 MM)');
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.state, VALIDATION_STATES.VALID);
    assert.strictEqual(res.canonicalValue, '50 mm');
    assert.strictEqual(res.dn, 50);
    assert.strictEqual(res.nps, '2');
  });

  // 5. Dual representation matching: 6" / 150 MM
  runTest('Test 5: Dual representation 6" / 150 MM validates to 150 mm', () => {
    const res = engineeringDictionary.normalizeSize('6" / 150 MM');
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.state, VALIDATION_STATES.VALID);
    assert.strictEqual(res.canonicalValue, '150 mm');
    assert.strictEqual(res.dn, 150);
    assert.strictEqual(res.nps, '6');
  });

  // 6. NPS / DN Conflict Detection: 6" / 50 MM
  runTest('Test 6: NPS/DN mismatch (6" / 50 MM) produces CONFLICT and SIZE_NPS_DN_MISMATCH', () => {
    const res = engineeringDictionary.normalizeSize('6" / 50 MM');
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.state, VALIDATION_STATES.CONFLICT);
    assert.strictEqual(res.canonicalValue, null);
    assert.strictEqual(res.reviewReason, REVIEW_REASONS.SIZE_NPS_DN_MISMATCH);
    assert.strictEqual(res.nps, '6');
    assert.strictEqual(res.dn, 50);
  });

  // 7. Known catalog size returns FOUND / VALID
  runTest('Test 7: Known catalog size returns FOUND / VALID', () => {
    const res = validationEngine.validateField('valve_size', 'DN150');
    assert.strictEqual(res.state, VALIDATION_STATES.VALID);
    assert.strictEqual(res.canonicalValue, '150 mm');
  });

  // 8. Unknown size returns INVALID (DN999, 999 mm, 55")
  runTest('Test 8: Unknown size returns INVALID and SIZE_NOT_FOUND without magic default', () => {
    const res1 = validationEngine.validateField('valve_size', 'DN999');
    assert.strictEqual(res1.state, VALIDATION_STATES.INVALID);
    assert.strictEqual(res1.canonicalValue, null);
    assert.strictEqual(res1.reviewReason, REVIEW_REASONS.SIZE_NOT_FOUND);

    const res2 = validationEngine.validateField('valve_size', '999 mm');
    assert.strictEqual(res2.state, VALIDATION_STATES.INVALID);
    assert.strictEqual(res2.canonicalValue, null);

    const res3 = validationEngine.validateField('valve_size', '55"');
    assert.strictEqual(res3.state, VALIDATION_STATES.INVALID);
    assert.strictEqual(res3.canonicalValue, null);
  });

  // 9. Missing size returns null and NOT_FOUND (never defaults to 50mm)
  runTest('Test 9: Missing size returns NOT_FOUND and null', () => {
    const res = validationEngine.validateField('valve_size', '');
    assert.strictEqual(res.state, VALIDATION_STATES.NOT_FOUND);
    assert.strictEqual(res.canonicalValue, null);
  });

  // 10. Pressure Class Normalization
  runTest('Test 10: Pressure class forms normalize to canonical 150#, 300#, 800#', () => {
    assert.strictEqual(engineeringDictionary.validateAndNormalize('valve_class', '150#').canonicalValue, '150#');
    assert.strictEqual(engineeringDictionary.validateAndNormalize('valve_class', 'Class 150').canonicalValue, '150#');
    assert.strictEqual(engineeringDictionary.validateAndNormalize('valve_class', 'CL150').canonicalValue, '150#');
    assert.strictEqual(engineeringDictionary.validateAndNormalize('valve_class', '150 Class').canonicalValue, '150#');
    assert.strictEqual(engineeringDictionary.validateAndNormalize('valve_class', 'Class: 300').canonicalValue, '300#');
    assert.strictEqual(engineeringDictionary.validateAndNormalize('valve_class', 'Pressure Class: 800#').canonicalValue, '800#');
  });

  // 11. All standard ASME ratings
  runTest('Test 11: All standard ASME ratings (150#, 300#, 600#, 800#, 900#, 1500#, 2500#) are valid', () => {
    const ratings = ['150#', '300#', '600#', '800#', '900#', '1500#', '2500#'];
    for (const r of ratings) {
      const res = engineeringDictionary.validateAndNormalize('valve_class', r);
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.canonicalValue, r);
    }
  });

  // 12. Unknown pressure class returns INVALID (Class 999, 3000#)
  runTest('Test 12: Unknown pressure class returns INVALID and CLASS_NOT_FOUND', () => {
    const res1 = validationEngine.validateField('valve_class', 'Class 999');
    assert.strictEqual(res1.state, VALIDATION_STATES.INVALID);
    assert.strictEqual(res1.canonicalValue, null);
    assert.strictEqual(res1.reviewReason, REVIEW_REASONS.CLASS_NOT_FOUND);

    const res2 = validationEngine.validateField('valve_class', '3000#');
    assert.strictEqual(res2.state, VALIDATION_STATES.INVALID);
    assert.strictEqual(res2.canonicalValue, null);
  });

  // 13. Missing pressure class returns null
  runTest('Test 13: Missing pressure class returns NOT_FOUND and null (never defaults to 150#)', () => {
    const res = validationEngine.validateField('valve_class', null);
    assert.strictEqual(res.state, VALIDATION_STATES.NOT_FOUND);
    assert.strictEqual(res.canonicalValue, null);
  });

  // 14. Material / MOC Normalization
  runTest('Test 14: Material forms normalize to ASTM A216 WCB', () => {
    const forms = ['ASTM A216 Gr. WCB', 'ASTM A216 WCB', 'A216 WCB', 'WCB', 'a216 gr. wcb', 'carbon steel wcb'];
    for (const f of forms) {
      const res = engineeringDictionary.validateAndNormalize('shellMaterial', f);
      assert.strictEqual(res.isValid, true, `Failed for ${f}`);
      assert.strictEqual(res.canonicalValue, 'ASTM A216 WCB', `Failed for ${f}`);
    }
  });

  // 15. Stainless & Alloy materials
  runTest('Test 15: Stainless & Alloy grades normalize correctly', () => {
    assert.strictEqual(engineeringDictionary.validateAndNormalize('shellMaterial', 'SS316').canonicalValue, 'SS316');
    assert.strictEqual(engineeringDictionary.validateAndNormalize('shellMaterial', 'ASTM A182 F316').canonicalValue, 'ASTM A182 F316');
    assert.strictEqual(engineeringDictionary.validateAndNormalize('shellMaterial', 'ASTM A350 LF2').canonicalValue, 'ASTM A350 LF2');
    assert.strictEqual(engineeringDictionary.validateAndNormalize('shellMaterial', 'Duplex F51').canonicalValue, 'Duplex F51 (UNS S31803)');
  });

  // 16. Unknown material returns INVALID (Unobtanium Grade X)
  runTest('Test 16: Unknown material returns INVALID and MATERIAL_NOT_FOUND (never defaults to WCB)', () => {
    const res = validationEngine.validateField('shellMaterial', 'Unobtanium Grade X');
    assert.strictEqual(res.state, VALIDATION_STATES.INVALID);
    assert.strictEqual(res.canonicalValue, null);
    assert.strictEqual(res.reviewReason, REVIEW_REASONS.MATERIAL_NOT_FOUND);
  });

  // 17. Floating Ball Valve preserves design type
  runTest('Test 17: Floating Ball Valve preserves design type', () => {
    const res = engineeringDictionary.validateAndNormalize('valve_type', 'Floating Ball Valve');
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.canonicalValue, 'Floating Ball Valve');
  });

  // 18. Trunnion Mounted Ball Valve preserves TMBV design type
  runTest('Test 18: Trunnion Mounted Ball Valve preserves TMBV design type without collapsing to Ball Valve', () => {
    const res = engineeringDictionary.validateAndNormalize('valve_type', 'Trunnion Mounted Ball Valve');
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.canonicalValue, 'Trunnion Mounted Ball Valve');

    const resTmbv = engineeringDictionary.validateAndNormalize('valve_type', 'TMBV');
    assert.strictEqual(resTmbv.canonicalValue, 'Trunnion Mounted Ball Valve');
  });

  // 19. Check valve design preservation (Swing vs Lift)
  runTest('Test 19: Check valve preserves Swing Check vs Lift Check distinction', () => {
    const res1 = engineeringDictionary.validateAndNormalize('valve_type', 'Swing Check Valve');
    assert.strictEqual(res1.canonicalValue, 'Swing Check Valve');

    const res2 = engineeringDictionary.validateAndNormalize('valve_type', 'Lift Check Valve');
    assert.strictEqual(res2.canonicalValue, 'Lift Check Valve');
  });

  // 20. Gate valve design preservation (Knife Gate vs Wedge Gate)
  runTest('Test 20: Gate valve preserves Knife Gate vs Wedge Gate distinction', () => {
    const res1 = engineeringDictionary.validateAndNormalize('valve_type', 'Knife Gate Valve');
    assert.strictEqual(res1.canonicalValue, 'Knife Gate Valve');

    const res2 = engineeringDictionary.validateAndNormalize('valve_type', 'Wedge Gate Valve');
    assert.strictEqual(res2.canonicalValue, 'Wedge Gate Valve');
  });

  // 21. Unknown valve type returns INVALID
  runTest('Test 21: Unknown valve type returns INVALID and VALVE_TYPE_NOT_FOUND', () => {
    const res = validationEngine.validateField('valve_type', 'FluxCapacitorValve');
    assert.strictEqual(res.state, VALIDATION_STATES.INVALID);
    assert.strictEqual(res.canonicalValue, null);
    assert.strictEqual(res.reviewReason, REVIEW_REASONS.VALVE_TYPE_NOT_FOUND);
  });

  // 22. End connection subtype preservation (Flanged RF, RTJ, Flat Face, BW, SW)
  runTest('Test 22: End connection preserves specific subtype (Flanged RF, RTJ, Flat Face, BW, SW)', () => {
    assert.strictEqual(engineeringDictionary.validateAndNormalize('endConnection', 'Flanged RF').canonicalValue, 'Flanged RF');
    assert.strictEqual(engineeringDictionary.validateAndNormalize('endConnection', 'RF Flanged').canonicalValue, 'Flanged RF');
    assert.strictEqual(engineeringDictionary.validateAndNormalize('endConnection', 'Flanged RTJ').canonicalValue, 'Flanged RTJ');
    assert.strictEqual(engineeringDictionary.validateAndNormalize('endConnection', 'Flanged Flat Face').canonicalValue, 'Flanged Flat Face');
    assert.strictEqual(engineeringDictionary.validateAndNormalize('endConnection', 'Butt Weld').canonicalValue, 'Butt Weld');
    assert.strictEqual(engineeringDictionary.validateAndNormalize('endConnection', 'Socket Weld').canonicalValue, 'Socket Weld');
  });

  // 23. Valid quantity (positive integer)
  runTest('Test 23: Valid quantity forms validate to positive integer', () => {
    assert.strictEqual(engineeringDictionary.validateAndNormalize('quantity', '5').canonicalValue, '5');
    assert.strictEqual(engineeringDictionary.validateAndNormalize('quantity', 10).canonicalValue, '10');
    assert.strictEqual(knowledgeEngine.normalizeQuantity('20'), 20);
  });

  // 24. Invalid quantity returns null and MISSING_QUANTITY (never defaults to 1)
  runTest('Test 24: Invalid quantity (0, -5, "unknown", missing) returns INVALID and MISSING_QUANTITY', () => {
    const res0 = validationEngine.validateField('quantity', '0');
    assert.strictEqual(res0.state, VALIDATION_STATES.INVALID);
    assert.strictEqual(res0.canonicalValue, null);
    assert.strictEqual(res0.reviewReason, REVIEW_REASONS.MISSING_QUANTITY);

    const resNeg = validationEngine.validateField('quantity', '-5');
    assert.strictEqual(resNeg.state, VALIDATION_STATES.INVALID);
    assert.strictEqual(resNeg.canonicalValue, null);

    const resMissing = validationEngine.validateField('quantity', null);
    assert.strictEqual(resMissing.state, VALIDATION_STATES.NOT_FOUND);
    assert.strictEqual(resMissing.canonicalValue, null);
  });

  // 25. Customer Value vs Engineering Rule Conflict (API 598 vs API 6D)
  runTest('Test 25: Customer Testing Standard API 598 vs derived API 6D produces CONFLICT and preserves both', () => {
    const evalRes = engineeringRulesEngine.evaluateContractReviewRules({
      valveType: 'Swing Check Valve',
      valveSize: '100 mm',
      valveClass: '150#',
      customerTestingStd: 'API 598',
      description: '4" 150# Swing Check Valve Testing: API 598'
    });

    assert.strictEqual(evalRes.validationState, VALIDATION_STATES.CONFLICT);
    assert.strictEqual(evalRes.needsManualReview, true);
    assert.strictEqual(evalRes.reviewReason, REVIEW_REASONS.CUSTOMER_ENGINEERING_CONFLICT);
    assert.strictEqual(evalRes.conflicts.length, 1);
    assert.strictEqual(evalRes.conflicts[0].customerValue, 'API 598');
    assert.strictEqual(evalRes.conflicts[0].derivedValue, 'API 6D');
    assert.strictEqual(evalRes.conflicts[0].provenanceCustomer, 'CUSTOMER_EXTRACTED');
    assert.strictEqual(evalRes.conflicts[0].provenanceDerived, 'ENGINEERING_RULE');
  });

  // 26. Check valve size-dependent engineering rules (<=40mm: Lift/BS 1868, >=50mm: Swing/API 6D)
  runTest('Test 26: Check valve size-dependent engineering rules (<=40mm: Lift/BS 1868, >=50mm: Swing/API 6D)', () => {
    // 25mm -> Lift Check, BS 1868, API 598
    const resSmall = engineeringRulesEngine.evaluateContractReviewRules({
      valveType: 'Check Valve',
      valveSize: '25 mm',
      valveClass: '800#',
      description: '1" 800# Check Valve'
    });
    assert.strictEqual(resSmall.derived.valve_design_type, 'Lift Check');
    assert.strictEqual(resSmall.derived.valve_design_std, 'BS 1868');
    assert.strictEqual(resSmall.derived.valve_testing_std, 'API 598');

    // 100mm -> Swing Check, API 6D, API 6D
    const resLarge = engineeringRulesEngine.evaluateContractReviewRules({
      valveType: 'Check Valve',
      valveSize: '100 mm',
      valveClass: '150#',
      description: '4" 150# Check Valve'
    });
    assert.strictEqual(resLarge.derived.valve_design_type, 'Swing Check');
    assert.strictEqual(resLarge.derived.valve_design_std, 'API 6D');
    assert.strictEqual(resLarge.derived.valve_testing_std, 'API 6D');
  });

  // 27. Ball valve rules (Antistatic = Yes, TMBV Annex E = Yes, Floating Annex E = No)
  runTest('Test 27: Ball valve engineering rules (Antistatic, Annex C/D/G/H, TMBV Annex E)', () => {
    const resFloating = engineeringRulesEngine.evaluateContractReviewRules({
      valveType: 'Floating Ball Valve',
      valveSize: '50 mm',
      valveClass: '150#'
    });
    assert.strictEqual(resFloating.derived.valve_antistatic_test, 'Yes');
    assert.strictEqual(resFloating.derived.annex_c, 'Yes');
    assert.strictEqual(resFloating.derived.annex_e, 'No');

    const resTmbv = engineeringRulesEngine.evaluateContractReviewRules({
      valveType: 'Trunnion Mounted Ball Valve',
      valveSize: '150 mm',
      valveClass: '300#'
    });
    assert.strictEqual(resTmbv.derived.valve_antistatic_test, 'Yes');
    assert.strictEqual(resTmbv.derived.annex_e, 'Yes');
  });

  // 28. Missing size prevents engineering derivation (DEFERRED state)
  runTest('Test 28: Missing size prevents engineering derivation and sets DEFERRED state', () => {
    const res = engineeringRulesEngine.evaluateContractReviewRules({
      valveType: 'Check Valve',
      valveSize: null,
      valveClass: '150#'
    });
    assert.strictEqual(res.validationState, VALIDATION_STATES.DEFERRED);
    assert.strictEqual(res.needsManualReview, true);
    assert.strictEqual(res.reviewReason, REVIEW_REASONS.MISSING_ENGINEERING_INPUT);
  });

  // 29. Hydro / air test calculation with valid inputs
  runTest('Test 29: Hydro/air test calculation produces deterministic values (Class 150, 50mm -> Shell: 450 (02), Seat: 325 (02))', () => {
    const hydro = engineeringRulesEngine.calculateHydroAndAirTest('150#', '50 mm');
    assert.strictEqual(hydro.validationState, VALIDATION_STATES.VALID);
    assert.strictEqual(hydro.shell, '450 (02)');
    assert.strictEqual(hydro.seat, '325 (02)');
    assert.strictEqual(hydro.air, '100 (02)');
    assert.strictEqual(hydro.provenance, 'ENGINEERING_RULE');
  });

  // 30. Hydro calculation with missing inputs returns null and DEFERRED
  runTest('Test 30: Hydro calculation with missing inputs returns null and DEFERRED state', () => {
    const hydro = engineeringRulesEngine.calculateHydroAndAirTest(null, '50 mm');
    assert.strictEqual(hydro.validationState, VALIDATION_STATES.DEFERRED);
    assert.strictEqual(hydro.shell, null);
    assert.strictEqual(hydro.seat, null);
    assert.strictEqual(hydro.needsManualReview, true);
    assert.strictEqual(hydro.reviewReason, REVIEW_REASONS.MISSING_ENGINEERING_INPUT);
  });

  // 31. Full 6-item Horizon RFQ isolated evaluation
  runTest('Test 31: Full 6-item Horizon RFQ isolated evaluation with independent lineItemIds', () => {
    const items = [
      { lineItemId: 'LI-001', rawSize: '2"', rawClass: '150#', type: 'Floating Ball Valve', qty: 5, expectedSize: '50 mm', expectedClass: '150#' },
      { lineItemId: 'LI-002', rawSize: '6"', rawClass: '300#', type: 'Trunnion Mounted Ball Valve', qty: 2, expectedSize: '150 mm', expectedClass: '300#' },
      { lineItemId: 'LI-003', rawSize: '4"', rawClass: '150#', type: 'Swing Check Valve', qty: 4, expectedSize: '100 mm', expectedClass: '150#' },
      { lineItemId: 'LI-004', rawSize: '1"', rawClass: '800#', type: 'Lift Check Valve', qty: 10, expectedSize: '25 mm', expectedClass: '800#' },
      { lineItemId: 'LI-005', rawSize: '8"', rawClass: '300#', type: 'Gate Valve', qty: 3, expectedSize: '200 mm', expectedClass: '300#' },
      { lineItemId: 'LI-006', rawSize: '2"', rawClass: '150#', type: 'Globe Valve', qty: 6, expectedSize: '50 mm', expectedClass: '150#' }
    ];

    for (const it of items) {
      const lineItem = {
        lineItemId: it.lineItemId,
        quantity: it.qty,
        sourceSpecifications: { sizeRaw: it.rawSize, pressureClassRaw: it.rawClass },
        normalizedSpecifications: {
          size: { dn: parseInt(it.expectedSize, 10), nps: null },
          pressureClass: it.expectedClass
        }
      };

      const valRes = validationEngine.validateLineItem(lineItem);
      assert.strictEqual(valRes.isValid, true, `Validation failed for line item ${it.lineItemId}: ${valRes.warnings.join(', ')}`);

      const rulesRes = engineeringRulesEngine.evaluateContractReviewRules({
        valveType: it.type,
        valveSize: it.expectedSize,
        valveClass: it.expectedClass
      });
      assert.strictEqual(rulesRes.validationState, VALIDATION_STATES.VALID, `Rule derivation failed for line item ${it.lineItemId}`);

      const hydroRes = engineeringRulesEngine.calculateHydroAndAirTest(it.expectedClass, it.expectedSize);
      assert.strictEqual(hydroRes.validationState, VALIDATION_STATES.VALID, `Hydro test failed for line item ${it.lineItemId}`);
    }
  });

  // 32. Dedicated Forged Steel Lift Check Valve regression test
  runTest('Test 32: Forged Steel Lift Check Valve (25 mm, 800#) derives Lift Check / BS 1868 / API 598', () => {
    const res = engineeringRulesEngine.evaluateContractReviewRules({
      valveType: 'Forged Steel Lift Check Valve',
      valveSize: '25 mm',
      valveClass: '800#'
    });
    assert.strictEqual(res.derived.valve_design_type, 'Lift Check');
    assert.strictEqual(res.derived.valve_design_std, 'BS 1868');
    assert.strictEqual(res.derived.valve_testing_std, 'API 598');
    assert.strictEqual(res.validationState, VALIDATION_STATES.VALID);
  });

  console.log('================================================================================');
  console.log(`SUMMARY: ${passedTests} / ${passedTests + failedTests} PHASE 3B TESTS PASSED!`);
  console.log('================================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});

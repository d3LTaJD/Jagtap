/**
 * testPhase3AExtractionCorrectness.js
 * Comprehensive verification suite for Phase 3A — Extraction Correctness Hardening.
 *
 * Tests all 28 required scenarios:
 * 1. Explicit size extraction (Size: 4").
 * 2. DN/NPS size extraction (DN100, NPS 4).
 * 3. Size context isolation (Valve Size: 4").
 * 4. Gasket/flange size does not become valve size (Gasket: 4 inch, Flange: DN100).
 * 5. Explicit pressure class extraction (Pressure Class: 300#, Class 800#, CL300).
 * 6. Unrelated metric number does not become class (Temperature: 300 C, Weight: 300 kg).
 * 7. Explicit valve type extraction (Ball Valve, Swing Check Valve, Gate Valve).
 * 8. Negated valve type is not accepted (Gate valve is not required).
 * 9. Ambiguous valve type requires review (Ball valve / Gate valve alternative).
 * 10. End connection extraction (Flanged RF, Butt Weld, Socket Weld).
 * 11. Negated end connection is not accepted (Flanged connection is not permitted).
 * 12. Operation/actuation extraction (Pneumatic, Gear Operated, Motorized).
 * 13. Negated actuation is not accepted (Pneumatic actuator not required).
 * 14. Quantity "Nos" extraction (5 Nos, 10 Nos.).
 * 15. Quantity "Sets" extraction (2 Sets).
 * 16. Quantity "EA" extraction (20 EA).
 * 17. Quantity "pcs" extraction (12 pcs, 5 pieces).
 * 18. Missing quantity remains null.
 * 19. Drawing identifier extraction (DWG-1234, PID-1002).
 * 20. "Drawing required" is not a drawing number.
 * 21. Tag identifier extraction (Tag: XV-101, Valve Tag: V-1001).
 * 22. "Tag required" is not a tag number.
 * 23. Negation remains within line-item scope (Item 1 negated does not negate Item 2).
 * 24. Six-item RFQ isolation (6 distinct items with distinct specs).
 * 25. Repeated size/class values remain isolated by lineItemId.
 * 26. Ambiguous candidates produce manual review.
 * 27. Raw evidence is preserved in rawValue.
 * 28. Existing provenance remains correct (CUSTOMER_EXTRACTED vs ENGINEERING_RULE).
 */

const assert = require('assert');

// Extractors and Engines
const sizeExtractor = require('../services/extraction/extractors/SizeExtractor');
const classExtractor = require('../services/extraction/extractors/ClassExtractor');
const valveExtractor = require('../services/extraction/extractors/ValveExtractor');
const endConnectionExtractor = require('../services/extraction/extractors/EndConnectionExtractor');
const operationExtractor = require('../services/extraction/extractors/OperationExtractor');
const quantityExtractor = require('../services/extraction/extractors/QuantityExtractor');
const drawingExtractor = require('../services/extraction/extractors/DrawingExtractor');
const tagExtractor = require('../services/extraction/extractors/TagExtractor');
const extractionPipeline = require('../services/extraction/ExtractionPipeline');
const validationEngine = require('../services/extraction/ValidationEngine');

console.log('='.repeat(80));
console.log('RUNNING PHASE 3A EXTRACTION CORRECTNESS VERIFICATION SUITE');
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
  // 1. Explicit size extraction
  runTest('Test 1: Explicit size extraction (Size: 4")', () => {
    const res = sizeExtractor.extract('Item: Ball Valve, Size: 4", Class: 150#');
    assert.ok(res, 'Expected size extraction result');
    assert.strictEqual(res.normalizedValue, '100 mm');
    assert.strictEqual(res.validationState, 'VALID');
  });

  // 2. DN/NPS size extraction
  runTest('Test 2: DN and NPS size extraction (DN100, NPS 4)', () => {
    const resDN = sizeExtractor.extract('Valve DN100 Class 300');
    assert.ok(resDN);
    assert.strictEqual(resDN.normalizedValue, '100 mm');

    const resNPS = sizeExtractor.extract('Ball Valve NPS 4 CL150');
    assert.ok(resNPS);
    assert.strictEqual(resNPS.normalizedValue, '100 mm');
  });

  // 3. Size context isolation
  runTest('Test 3: Size context isolation (Valve Size: 4")', () => {
    const res = sizeExtractor.extract('Valve Size: 4" (100 mm), Body MOC: WCB');
    assert.ok(res);
    assert.strictEqual(res.normalizedValue, '100 mm');
  });

  // 4. Gasket/flange size does not become valve size
  runTest('Test 4: Gasket/flange size does not become valve size', () => {
    const resGasket = sizeExtractor.extract('Accessories: Gasket: 4 inch, Studs: M20');
    assert.strictEqual(resGasket, null, 'Gasket size must not be extracted as valve size');

    const resFlange = sizeExtractor.extract('Connection: Flange: DN100 RF');
    assert.strictEqual(resFlange, null, 'Flange prefix size must not be extracted as standalone valve size');
  });

  // 5. Explicit pressure class extraction
  runTest('Test 5: Explicit pressure class extraction (Pressure Class: 300#, Class 800#, CL300)', () => {
    const res1 = classExtractor.extract('Gate Valve, Pressure Class: 300#');
    assert.ok(res1);
    assert.strictEqual(res1.normalizedValue, '300#');

    const res2 = classExtractor.extract('Globe Valve, Class 800#');
    assert.ok(res2);
    assert.strictEqual(res2.normalizedValue, '800#');

    const res3 = classExtractor.extract('Ball Valve, CL300 RF');
    assert.ok(res3);
    assert.strictEqual(res3.normalizedValue, '300#');
  });

  // 6. Unrelated metric number does not become class
  runTest('Test 6: Unrelated metric number does not become class (Temperature: 300 C, Weight: 300 kg)', () => {
    const resTemp = classExtractor.extract('Design Temperature: 300 C, Max Pressure: 20 bar');
    assert.strictEqual(resTemp, null, 'Temperature 300 C must not become class 300#');

    const resWeight = classExtractor.extract('Total Weight: 300 kg');
    assert.strictEqual(resWeight, null, 'Weight 300 kg must not become class 300#');
  });

  // 7. Explicit valve type extraction
  runTest('Test 7: Explicit valve type extraction (Ball Valve, Swing Check Valve, Gate Valve)', () => {
    const resBall = valveExtractor.extract('Supply 2" 150# Ball Valve');
    assert.strictEqual(resBall.normalizedValue, 'Ball Valve');

    const resCheck = valveExtractor.extract('Supply 4" 300# Swing Check Valve');
    assert.ok(resCheck.normalizedValue === 'Check Valve' || resCheck.normalizedValue === 'Swing Check Valve');

    const resGate = valveExtractor.extract('Supply 1" 800# Wedge Gate Valve');
    assert.ok(resGate.normalizedValue === 'Gate Valve' || resGate.normalizedValue === 'Wedge Gate Valve');
  });

  // 8. Negated valve type is not accepted
  runTest('Test 8: Negated valve type is not accepted (Gate valve is not required)', () => {
    const res = valveExtractor.extract('Gate valve is not required for this package');
    assert.ok(res);
    assert.strictEqual(res.normalizedValue, null, 'Negated valve type must have null normalizedValue');
    assert.strictEqual(res.validationState, 'INVALID', 'Negated valve type must be marked INVALID');
  });

  // 9. Ambiguous valve type requires review
  runTest('Test 9: Ambiguous valve type requires review (Ball valve / Gate valve alternative)', () => {
    const res = valveExtractor.extract('Item: Ball valve / Gate valve alternative as per vendor stock');
    assert.ok(res);
    assert.strictEqual(res.normalizedValue, null, 'Ambiguous valve type must have null normalizedValue');
    assert.strictEqual(res.validationState, 'AMBIGUOUS', 'Ambiguous valve type must have validationState AMBIGUOUS');
  });

  // 10. End connection extraction
  runTest('Test 10: End connection extraction (Flanged RF, Butt Weld, Socket Weld)', () => {
    const resFlanged = endConnectionExtractor.extract('2" 150# Ball Valve Flanged RF ends');
    assert.ok(resFlanged.normalizedValue === 'Flanged' || resFlanged.normalizedValue === 'Flanged RF');

    const resBW = endConnectionExtractor.extract('6" 300# Gate Valve Butt Weld ends');
    assert.strictEqual(resBW.normalizedValue, 'Butt Weld');

    const resSW = endConnectionExtractor.extract('1" 800# Globe Valve Socket Weld ends');
    assert.strictEqual(resSW.normalizedValue, 'Socket Weld');
  });

  // 11. Negated end connection is not accepted
  runTest('Test 11: Negated end connection is not accepted (Flanged connection is not permitted)', () => {
    const res = endConnectionExtractor.extract('Flanged connection is not permitted, Socket Weld required');
    // The first match is flanged which is negated
    assert.ok(res);
    assert.strictEqual(res.normalizedValue, null);
    assert.strictEqual(res.validationState, 'INVALID');
  });

  // 12. Operation/actuation extraction
  runTest('Test 12: Operation/actuation extraction (Pneumatic, Gear Operated, Motorized, Manual)', () => {
    const resPneu = operationExtractor.extract('2" 150# Ball Valve with Pneumatic Actuator');
    assert.strictEqual(resPneu.normalizedValue, 'Pneumatic');

    const resGear = operationExtractor.extract('8" 300# Gate Valve Gear Operated');
    assert.strictEqual(resGear.normalizedValue, 'Gear Operated');

    const resMotor = operationExtractor.extract('10" 150# Butterfly Valve Motorized');
    assert.strictEqual(resMotor.normalizedValue, 'Motorized');
  });

  // 13. Negated actuation is not accepted
  runTest('Test 13: Negated actuation is not accepted (Pneumatic actuator not required)', () => {
    const res = operationExtractor.extract('Pneumatic actuator not required for this line item');
    assert.ok(res);
    assert.strictEqual(res.normalizedValue, null);
    assert.strictEqual(res.validationState, 'INVALID');
  });

  // 14. Quantity "Nos" extraction
  runTest('Test 14: Quantity "Nos" extraction (5 Nos, 10 Nos.)', () => {
    const res1 = quantityExtractor.extract('2" 150# Ball Valve - 5 Nos');
    assert.ok(res1);
    assert.strictEqual(res1.normalizedValue, '5');

    const res2 = quantityExtractor.extract('10 Nos. Gate Valves required');
    assert.ok(res2);
    assert.strictEqual(res2.normalizedValue, '10');
  });

  // 15. Quantity "Sets" extraction
  runTest('Test 15: Quantity "Sets" extraction (2 Sets)', () => {
    const res = quantityExtractor.extract('Control Valve Assembly - 2 Sets');
    assert.ok(res);
    assert.strictEqual(res.normalizedValue, '2');
  });

  // 16. Quantity "EA" extraction
  runTest('Test 16: Quantity "EA" extraction (20 EA)', () => {
    const res = quantityExtractor.extract('Check Valve 4" 150# - 20 EA');
    assert.ok(res);
    assert.strictEqual(res.normalizedValue, '20');
  });

  // 17. Quantity "pcs" extraction
  runTest('Test 17: Quantity "pcs" extraction (12 pcs, 5 pieces)', () => {
    const res1 = quantityExtractor.extract('Ball Valve 1" 800# - 12 pcs');
    assert.ok(res1);
    assert.strictEqual(res1.normalizedValue, '12');

    const res2 = quantityExtractor.extract('Globe Valve 2" 300# - 5 pieces');
    assert.ok(res2);
    assert.strictEqual(res2.normalizedValue, '5');
  });

  // 18. Missing quantity remains null
  runTest('Test 18: Missing quantity remains null', () => {
    const res = quantityExtractor.extract('Supply 2" 150# Ball Valve WCB Body');
    assert.strictEqual(res, null, 'When no quantity is present, extractor must return null');
  });

  // 19. Drawing identifier extraction
  runTest('Test 19: Drawing identifier extraction (DWG-1234, PID-1002)', () => {
    const res1 = drawingExtractor.extract('Valve to be built per DWG-1234-A');
    assert.ok(res1);
    assert.strictEqual(res1.normalizedValue, 'DWG-1234-A');

    const res2 = drawingExtractor.extract('Reference P&ID: PID-1002-01');
    assert.ok(res2);
    assert.strictEqual(res2.normalizedValue, 'PID-1002-01');
  });

  // 20. "Drawing required" is not a drawing number
  runTest('Test 20: "Drawing required" is not a drawing number', () => {
    const res = drawingExtractor.extract('Detailed GA Drawing required before fabrication');
    assert.strictEqual(res, null, '"Drawing required" must not be extracted as drawing number');
  });

  // 21. Tag identifier extraction
  runTest('Test 21: Tag identifier extraction (Tag: XV-101, Valve Tag: V-1001)', () => {
    const res1 = tagExtractor.extract('Valve Tag: XV-101');
    assert.ok(res1);
    assert.strictEqual(res1.normalizedValue, 'XV-101');

    const res2 = tagExtractor.extract('Item Tag: V-1001-A');
    assert.ok(res2);
    assert.strictEqual(res2.normalizedValue, 'V-1001-A');
  });

  // 22. "Tag required" is not a tag number
  runTest('Test 22: "Tag required" is not a tag number', () => {
    const res = tagExtractor.extract('Stainless steel Tag required on all valves');
    assert.strictEqual(res, null, '"Tag required" must not be extracted as a tag number');
  });

  // 23. Negation remains within line-item scope
  await runAsyncTest('Test 23: Negation in Item 1 does not affect Item 2', async () => {
    const fieldDefinitions = [
      { fieldName: 'valve_operating', isRequired: false },
      { fieldName: 'valve_size', isRequired: true },
      { fieldName: 'valve_class', isRequired: true }
    ];

    // Item 1 has negated pneumatic
    const res1 = await extractionPipeline.processProductGatedPipeline({
      textContext: 'Item 1: 2" 150# Ball Valve. Pneumatic actuator not required, manual only.',
      fieldDefinitions,
      productDescription: '2" 150# Ball Valve Pneumatic actuator not required',
      lineItemId: 'LI-NEG-001'
    });

    // Item 2 has required pneumatic
    const res2 = await extractionPipeline.processProductGatedPipeline({
      textContext: 'Item 2: 4" 300# Ball Valve with Pneumatic Actuator required.',
      fieldDefinitions,
      productDescription: '4" 300# Ball Valve with Pneumatic Actuator',
      lineItemId: 'LI-POS-002'
    });

    assert.strictEqual(res1.validatedDynamicFields.valve_operating, undefined);
    assert.strictEqual(res1.fieldConfidences.valve_operating.validationState, 'INVALID');

    assert.strictEqual(res2.validatedDynamicFields.valve_operating, 'Pneumatic');
    assert.strictEqual(res2.fieldConfidences.valve_operating.validationState, 'VALID');
  });

  // 24. Six-item RFQ isolation
  await runAsyncTest('Test 24: Six-item RFQ preserves unique specs per lineItemId', async () => {
    const items = [
      { lineItemId: 'LI-001', desc: '50 mm 150# Ball Valve Qty 5 Flanged RF', size: '50 mm', class: '150#', qty: '5' },
      { lineItemId: 'LI-002', desc: '150 mm 300# Ball Valve Qty 2 Butt Weld', size: '150 mm', class: '300#', qty: '2' },
      { lineItemId: 'LI-003', desc: '100 mm 150# Ball Valve Qty 4 Flanged RF', size: '100 mm', class: '150#', qty: '4' },
      { lineItemId: 'LI-004', desc: '25 mm 800# Gate Valve Qty 10 Socket Weld', size: '25 mm', class: '800#', qty: '10' },
      { lineItemId: 'LI-005', desc: '200 mm 300# Globe Valve Qty 3 Flanged RTJ', size: '200 mm', class: '300#', qty: '3' },
      { lineItemId: 'LI-006', desc: '50 mm 150# Check Valve Qty 6 Flanged RF', size: '50 mm', class: '150#', qty: '6' }
    ];

    const fieldDefinitions = [
      { fieldName: 'valve_size', isRequired: true },
      { fieldName: 'valve_class', isRequired: true },
      { fieldName: 'quantity', isRequired: true }
    ];

    for (const it of items) {
      const res = await extractionPipeline.processProductGatedPipeline({
        textContext: it.desc,
        fieldDefinitions,
        productDescription: it.desc,
        lineItemId: it.lineItemId
      });
      assert.strictEqual(res.validatedDynamicFields.valve_size, it.size, `Size mismatch on ${it.lineItemId}`);
      assert.strictEqual(res.validatedDynamicFields.valve_class, it.class, `Class mismatch on ${it.lineItemId}`);
      assert.strictEqual(res.validatedDynamicFields.quantity, it.qty, `Qty mismatch on ${it.lineItemId}`);
    }
  });

  // 25. Repeated size/class values remain isolated by lineItemId
  await runAsyncTest('Test 25: Repeated size/class values (Item 1: 50mm 150#, Item 6: 50mm 150#) remain isolated', async () => {
    const fieldDefinitions = [
      { fieldName: 'valve_size', isRequired: true },
      { fieldName: 'valve_class', isRequired: true }
    ];

    const res1 = await extractionPipeline.processProductGatedPipeline({
      textContext: 'Item 1: 50 mm 150# Ball Valve',
      fieldDefinitions,
      productDescription: '50 mm 150# Ball Valve',
      lineItemId: 'ENQ-ISO-LI-001'
    });

    const res6 = await extractionPipeline.processProductGatedPipeline({
      textContext: 'Item 6: 50 mm 150# Check Valve',
      fieldDefinitions,
      productDescription: '50 mm 150# Check Valve',
      lineItemId: 'ENQ-ISO-LI-006'
    });

    assert.strictEqual(res1.validatedDynamicFields.valve_size, '50 mm');
    assert.strictEqual(res6.validatedDynamicFields.valve_size, '50 mm');
    assert.notStrictEqual(res1.lineItemId, res6.lineItemId);
  });

  // 26. Ambiguous candidates produce manual review
  runTest('Test 26: Ambiguous candidates produce validationState = AMBIGUOUS and needsManualReview', () => {
    const ambValve = valveExtractor.extract('Supply Ball Valve or Gate Valve as per choice');
    assert.strictEqual(ambValve.validationState, 'AMBIGUOUS');
    assert.strictEqual(ambValve.normalizedValue, null);

    const lineItemReview = validationEngine.validateLineItem({
      lineItemId: 'LI-AMB-001',
      quantity: 5,
      sourceSpecifications: {},
      normalizedSpecifications: { size: null, pressureClass: null },
      dynamicFields: {}
    });
    assert.strictEqual(lineItemReview.needsManualReview, true);
  });

  // 27. Raw evidence is preserved in rawValue
  runTest('Test 27: Raw evidence is preserved in rawValue', () => {
    const rawText = 'Gate valve is not required';
    const res = valveExtractor.extract(rawText);
    assert.strictEqual(res.rawValue, 'Gate valve');
    assert.strictEqual(res.normalizedValue, null);
    assert.strictEqual(res.validationState, 'INVALID');
    assert.ok(res.reasoning[0].includes('Valve type negated'));
  });

  // 28. Existing provenance remains correct
  await runAsyncTest('Test 28: Provenance remains CUSTOMER_EXTRACTED for regex match and ENGINEERING_RULE for derived', async () => {
    const fieldDefinitions = [
      { fieldName: 'valve_size', isRequired: true },
      { fieldName: 'valve_testing_std', isRequired: false }
    ];

    const res = await extractionPipeline.processProductGatedPipeline({
      textContext: '2" 150# Ball Valve',
      fieldDefinitions,
      productDescription: '2" 150# Ball Valve',
      lineItemId: 'LI-PROV-001'
    });

    assert.strictEqual(res.fieldConfidences.valve_size.provenance, 'CUSTOMER_EXTRACTED');
    assert.strictEqual(res.fieldConfidences.valve_testing_std.provenance, 'ENGINEERING_RULE');
    assert.strictEqual(res.fieldConfidences.valve_testing_std.validationState, 'DEFERRED');
  });

  console.log('='.repeat(80));
  console.log(`SUMMARY: ${passed} / ${passed + failed} PHASE 3A EXTRACTION TESTS PASSED!`);
  console.log('='.repeat(80));

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
})();

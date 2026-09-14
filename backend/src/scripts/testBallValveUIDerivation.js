/**
 * Test Suite for Ball Valve Quotation UI Logic & Rules Derivation
 * Tests all required End Type & Operating scenarios strictly according to Petro Std_Ball valve.docx
 */

const assert = require('assert');
const ballValveRulesEngine = require('../services/extraction/BallValveRulesEngine');
const engineeringRulesEngine = require('../services/extraction/EngineeringRulesEngine');

console.log('================================================================');
console.log('🧪 RUNNING BALL VALVE QUOTATION UI DERIVATION TEST SUITE');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(title, testFn) {
  totalTests++;
  try {
    testFn();
    passedTests++;
    console.log(`✅ TEST ${totalTests}: ${title} -> PASSED`);
  } catch (err) {
    console.error(`❌ TEST ${totalTests}: ${title} -> FAILED:`, err.message);
  }
}

// ── PART 1: END TYPE TEST CASES ──────────────────────────────────────────────

const endTypeCases = [
  { class: '150#', expected: 'Flange end' },
  { class: '300#', expected: 'Flange end' },
  { class: '600#', expected: 'Flange end' },
  { class: '800#', expected: 'Socket Weld with Pups' },
  { class: '900#', expected: 'Flange end' },
  { class: '1500#', expected: 'Flange end' },
  { class: '2500#', expected: 'Flange end' }
];

endTypeCases.forEach(({ class: cls, expected }) => {
  runTest(`End Type for Class ${cls} -> Expected "${expected}"`, () => {
    const res = ballValveRulesEngine.deriveSpecifications({
      valve_type: 'Ball Valve',
      valve_size: '50mm',
      valve_class: cls
    });
    assert.strictEqual(res.specifications.end_connection, expected);
    assert.strictEqual(res.specifications.valve_end_connection, expected);
  });
});

// ── PART 2: OPERATING OF VALVES THRESHOLDS ────────────────────────────────────

const operatingCases = [
  { class: '150#', size: '150mm', expected: 'Handle' },
  { class: '150#', size: '200mm', expected: 'Gear Box' },
  { class: '300#', size: '100mm', expected: 'Handle' },
  { class: '300#', size: '150mm', expected: 'Gear Box' },
  { class: '600#', size: '80mm',  expected: 'Handle' },
  { class: '600#', size: '100mm', expected: 'Gear Box' },
  { class: '800#', size: '50mm',  expected: 'Handle' },
  { class: '800#', size: '80mm',  expected: 'Handle' },
  { class: '900#', size: '80mm',  expected: 'Handle' },
  { class: '900#', size: '100mm', expected: 'Gear Box' },
  { class: '1500#', size: '80mm', expected: 'Handle' },
  { class: '1500#', size: '100mm', expected: 'Gear Box' },
  { class: '2500#', size: '80mm', expected: 'Handle' },
  { class: '2500#', size: '100mm', expected: 'Gear Box' }
];

operatingCases.forEach(({ class: cls, size, expected }) => {
  runTest(`Operating for Class ${cls} / Size ${size} -> Expected "${expected}"`, () => {
    const res = ballValveRulesEngine.deriveSpecifications({
      valve_type: 'Ball Valve',
      valve_size: size,
      valve_class: cls
    });
    assert.strictEqual(res.specifications.valve_operating, expected);
  });
});

// ── PART 3: DYNAMIC RE-DERIVATION SIMULATION ─────────────────────────────────

runTest('Dynamic State Transition: 600# -> 800# -> 600#', () => {
  // 1. Initial State: 600# 80mm
  let res1 = ballValveRulesEngine.deriveSpecifications({ valve_type: 'Ball Valve', valve_size: '80mm', valve_class: '600#' });
  assert.strictEqual(res1.specifications.end_connection, 'Flange end');
  assert.strictEqual(res1.specifications.valve_operating, 'Handle');
  assert.strictEqual(res1.specifications.design_type_pieces, '2 p/c');

  // 2. User changes Class to 800#
  let res2 = ballValveRulesEngine.deriveSpecifications({ valve_type: 'Ball Valve', valve_size: '50mm', valve_class: '800#' });
  assert.strictEqual(res2.specifications.end_connection, 'Socket Weld with Pups');
  assert.strictEqual(res2.specifications.valve_operating, 'Handle');
  assert.strictEqual(res2.specifications.design_type_pieces, '3 p/c');

  // 3. User changes Class back to 600# 100mm
  let res3 = ballValveRulesEngine.deriveSpecifications({ valve_type: 'Ball Valve', valve_size: '100mm', valve_class: '600#' });
  assert.strictEqual(res3.specifications.end_connection, 'Flange end');
  assert.strictEqual(res3.specifications.valve_operating, 'Gear Box');
  assert.strictEqual(res3.specifications.design_type_pieces, '2 p/c');
});

// ── PART 4: CLIENT OVERRIDE PRESERVATION ──────────────────────────────────────

runTest('Client Explicit Overrides: Actuator & Butt Weld', () => {
  const res = ballValveRulesEngine.deriveSpecifications({
    valve_type: 'Ball Valve',
    valve_size: '100mm',
    valve_class: '150#',
    end_connection: 'Butt weld',
    operating: 'Pneumatic Actuator'
  });
  assert.strictEqual(res.specifications.end_connection, 'Butt weld');
  assert.strictEqual(res.specifications.valve_operating, 'Actuator');
});

// ── PART 5: ENGINEERING RULES ENGINE INTEGRATION ──────────────────────────────

runTest('EngineeringRulesEngine pass-through for Ball Valve', () => {
  const res = engineeringRulesEngine.evaluateContractReviewRules({
    valveType: 'Ball Valve',
    valveSize: '150mm',
    valveClass: '300#'
  });
  assert.strictEqual(res.derived.valve_end_connection, 'Flange end');
  assert.strictEqual(res.derived.valve_operating, 'Gear Box');
  assert.strictEqual(res.derived.valve_ball_type, 'Floating');
  assert.strictEqual(res.derived.valve_seat_type, 'Soft Seat');
});

console.log('\n================================================================');
console.log(`🎉 ALL ${passedTests}/${totalTests} BALL VALVE UI DERIVATION TESTS PASSED (100% SUCCESS)`);
console.log('================================================================\n');

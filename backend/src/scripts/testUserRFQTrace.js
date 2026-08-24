const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const assert = require('assert');

const boqParserService = require('../services/boqParserService');
const extractionPipeline = require('../services/extraction/ExtractionPipeline');
const engineeringRulesEngine = require('../services/extraction/EngineeringRulesEngine');

async function testUserRFQ() {
  console.log('='.repeat(80));
  console.log('AUDIT & VERIFICATION: LOCAL-FIRST EXTRACTION TRACE');
  console.log('='.repeat(80));

  const testEmailBody = "Please quote 2 Nos Ball Valves, 50 mm, Class 150#, Body MOC ASTM A216 WCB. End connection: Flanged RF. PMI test required.";

  console.log('\n--- STEP 1: Deterministic Line Item Parsing (boqParserService) ---');
  const parsedProducts = boqParserService.parseEmailBodyLineItems(testEmailBody);
  console.log('Parsed Products count:', parsedProducts.length);
  console.log('Product 0:', JSON.stringify(parsedProducts[0], null, 2));

  assert.strictEqual(parsedProducts.length, 1, 'Must find 1 deterministic product');
  assert.strictEqual(parsedProducts[0].quantity, 2, 'Quantity must be 2');
  assert.strictEqual(parsedProducts[0].unit, 'NOS', 'Unit must be NOS');
  assert.strictEqual(parsedProducts[0].productCategory, 'Valves', 'Category must be Valves');

  console.log('\n--- STEP 2: Extraction Pipeline (processDocument - Deterministic Plugins) ---');
  const pipelineRes = extractionPipeline.processDocument(testEmailBody, { documentId: 'TEST-TRACE-001' });
  const legacy = pipelineRes.legacySpecifications || {};
  const docFields = pipelineRes.fields || {};

  console.log('Document-level Deterministic Extractions:');
  console.log('  valve_type:           ', legacy.valve_type, `(confidence: ${docFields.valve_type?.score?.confidence}%)`);
  console.log('  valve_size:           ', legacy.valve_size, `(confidence: ${docFields.valve_size?.score?.confidence}%)`);
  console.log('  valve_class:          ', legacy.valve_class, `(confidence: ${docFields.valve_class?.score?.confidence}%)`);
  console.log('  quantity:             ', legacy.quantity, `(confidence: ${docFields.quantity?.score?.confidence}%)`);
  console.log('  endConnection:        ', legacy.endConnection, `(confidence: ${docFields.endConnection?.score?.confidence}%)`);
  console.log('  shellMaterial:        ', legacy.shellMaterial, `(confidence: ${docFields.shellMaterial?.score?.confidence}%)`);

  assert.strictEqual(legacy.valve_type, 'Ball Valve');
  assert.strictEqual(legacy.valve_size, '50 mm');
  assert.strictEqual(legacy.valve_class, '150#');
  assert.strictEqual(legacy.quantity, '2');
  assert.strictEqual(legacy.endConnection, 'Flanged RF');
  assert.strictEqual(legacy.shellMaterial, 'ASTM A216 WCB');

  console.log('\n--- STEP 3: Production Gated Pipeline (processProductGatedPipeline) ---');
  const mockFieldDefs = [
    { fieldName: 'valve_type', fieldLabel: 'Valve Type', fieldType: 'Dropdown (Single)', isRequired: true, options: ['Ball Valve', 'Gate Valve', 'Globe Valve', 'Check Valve'] },
    { fieldName: 'valve_size', fieldLabel: 'Valve Size', fieldType: 'Dropdown (Single)', isRequired: true, options: ['15 mm', '25 mm', '50 mm', '100 mm', '150 mm'] },
    { fieldName: 'valve_class', fieldLabel: 'Pressure Class', fieldType: 'Dropdown (Single)', isRequired: true, options: ['150#', '300#', '600#', '800#'] },
    { fieldName: 'quantity', fieldLabel: 'Quantity', fieldType: 'Number', isRequired: true },
    { fieldName: 'valve_end_connection', fieldLabel: 'End Connection', fieldType: 'Dropdown (Single)', isRequired: false, options: ['Flanged RF', 'Flanged RTJ', 'Butt Weld'] },
    { fieldName: 'valve_moc_body', fieldLabel: 'Body MOC', fieldType: 'Dropdown (Single)', isRequired: false, options: ['ASTM A216 WCB', 'ASTM A105', 'SS316'] },
    { fieldName: 'valve_operating', fieldLabel: 'Operating Type', fieldType: 'Dropdown (Single)', isRequired: false, options: ['Handle', 'Gear Box', 'Actuator', 'Hand Wheel'] },
    { fieldName: 'valve_design_std', fieldLabel: 'Design Standard', fieldType: 'Text', isRequired: false },
    { fieldName: 'valve_testing_std', fieldLabel: 'Testing Standard', fieldType: 'Text', isRequired: false }
  ];

  const gatedRes = await extractionPipeline.processProductGatedPipeline({
    textContext: testEmailBody,
    fieldDefinitions: mockFieldDefs,
    productDescription: parsedProducts[0].productDescription,
    enquiryId: null,
    productIndex: 0,
    lineItemId: 'LI-001'
  });

  const dynFields = gatedRes.validatedDynamicFields || {};
  const confidences = gatedRes.fieldConfidences || {};

  console.log('Gated Production Extractions:');
  console.log('  valve_type:           ', dynFields.valve_type, `| provenance: ${confidences.valve_type?.provenance} | source: ${confidences.valve_type?.source}`);
  console.log('  valve_size:           ', dynFields.valve_size, `| provenance: ${confidences.valve_size?.provenance} | source: ${confidences.valve_size?.source}`);
  console.log('  valve_class:          ', dynFields.valve_class, `| provenance: ${confidences.valve_class?.provenance} | source: ${confidences.valve_class?.source}`);
  console.log('  quantity:             ', dynFields.quantity, `| provenance: ${confidences.quantity?.provenance} | source: ${confidences.quantity?.source}`);
  console.log('  valve_end_connection: ', dynFields.valve_end_connection, `| provenance: ${confidences.valve_end_connection?.provenance} | source: ${confidences.valve_end_connection?.source}`);
  console.log('  valve_moc_body:       ', dynFields.valve_moc_body, `| provenance: ${confidences.valve_moc_body?.provenance} | source: ${confidences.valve_moc_body?.source}`);
  console.log('  valve_operating:      ', dynFields.valve_operating, `| provenance: ${confidences.valve_operating?.provenance}`);
  console.log('  valve_design_std:     ', dynFields.valve_design_std, `| provenance: ${confidences.valve_design_std?.provenance}`);

  // Assertions on Customer Evidence
  assert.strictEqual(dynFields.valve_type, 'Ball Valve');
  assert.strictEqual(confidences.valve_type?.provenance, 'CUSTOMER_EXTRACTED');
  assert.strictEqual(confidences.valve_type?.source, 'REGEX');

  assert.strictEqual(dynFields.valve_size, '50 mm');
  assert.strictEqual(confidences.valve_size?.provenance, 'CUSTOMER_EXTRACTED');
  assert.strictEqual(confidences.valve_size?.source, 'REGEX');

  assert.strictEqual(dynFields.valve_class, '150#');
  assert.strictEqual(confidences.valve_class?.provenance, 'CUSTOMER_EXTRACTED');
  assert.strictEqual(confidences.valve_class?.source, 'REGEX');

  assert.strictEqual(dynFields.quantity, '2');
  assert.strictEqual(confidences.quantity?.provenance, 'CUSTOMER_EXTRACTED');
  assert.strictEqual(confidences.quantity?.source, 'REGEX');

  assert.strictEqual(dynFields.valve_end_connection, 'Flanged RF');
  assert.strictEqual(confidences.valve_end_connection?.provenance, 'CUSTOMER_EXTRACTED');
  assert.strictEqual(confidences.valve_end_connection?.source, 'REGEX');

  assert.strictEqual(dynFields.valve_moc_body, 'ASTM A216 WCB');
  assert.strictEqual(confidences.valve_moc_body?.provenance, 'CUSTOMER_EXTRACTED');
  assert.strictEqual(confidences.valve_moc_body?.source, 'REGEX');

  // Verify valve_operating is NOT 150# (must be null/undefined)
  assert.notStrictEqual(dynFields.valve_operating, '150#', 'valve_operating must never be 150#');
  assert.strictEqual(dynFields.valve_operating, undefined, 'valve_operating must remain undefined when unstated');

  // Verify engineering fields are deferred to rules engine
  assert.strictEqual(confidences.valve_design_std?.provenance, 'ENGINEERING_RULE');
  assert.strictEqual(confidences.valve_design_std?.validationState, 'DEFERRED');

  console.log('\n--- STEP 4: Engineering Rules & Contract Review Derivation ---');
  const rules = engineeringRulesEngine.evaluateContractReviewRules({
    valveType: dynFields.valve_type,
    valveSize: dynFields.valve_size,
    valveClass: dynFields.valve_class,
    endConnection: dynFields.valve_end_connection,
    bodyMoc: dynFields.valve_moc_body
  });

  console.log('Derived Engineering Specifications:');
  console.log('  valve_design_type:    ', rules.derived.valve_design_type, '(provenance: ENGINEERING_RULE)');
  console.log('  valve_design_std:     ', rules.derived.valve_design_std, '(provenance: ENGINEERING_RULE)');
  console.log('  valve_testing_std:    ', rules.derived.valve_testing_std, '(provenance: ENGINEERING_RULE)');
  console.log('  annex_e:              ', rules.derived.annex_e, '(provenance: ENGINEERING_RULE)');

  const hydro = engineeringRulesEngine.calculateHydroAndAirTest(dynFields.valve_class, dynFields.valve_size);
  console.log('Derived Hydro/Air Test Pressures:');
  console.log('  shellTestPressure:    ', hydro.shell, '(provenance: ENGINEERING_RULE)');
  console.log('  seatTestPressure:     ', hydro.seat, '(provenance: ENGINEERING_RULE)');
  console.log('  airSeatTestPressure:  ', hydro.air, '(provenance: ENGINEERING_RULE)');

  assert.strictEqual(rules.derived.valve_design_type, 'Floating Ball Valve');
  assert.strictEqual(rules.derived.valve_design_std, 'API 6D');
  assert.strictEqual(rules.derived.valve_testing_std, 'API 6D');
  assert.strictEqual(rules.derived.annex_e, 'No');
  assert.strictEqual(hydro.shell, '450 (02)');
  assert.strictEqual(hydro.seat, '325 (02)');
  assert.strictEqual(hydro.air, '100 (02)');

  console.log('\n' + '='.repeat(80));
  console.log('ALL AUDIT STEPS & ASSERTIONS PASSED: 100% LOCAL-FIRST DETERMINISTIC PROVENANCE');
  console.log('='.repeat(80));
}

testUserRFQ().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

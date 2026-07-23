/**
 * Regression Test: Globe Valve Size Extraction
 * Verifies that line item "7) 2"Globe Valve,FE 300# =1 Nos" extracted from email
 * produces valve_size = "50" / "50 mm" deterministically.
 */

require('dotenv').config();

const extractionPipeline = require('../services/extraction/ExtractionPipeline');
const aiService = require('../services/aiService');

const emailBody = `Dear Sir,

We kindly request you to provide your best quotation for the following Ball Valves:

 1) 10" Butt Welded Valve,TMBV ,300# =1 Nos

 2) 4" Flange Ended Valve ,300# Nos =6 Nos

 3) 2" Flange Ended Valve  300# =2 Nos

 4) 2" Flange Ended Valve ,600# = 02 Nos

 5) 1/2" Valve 800# Ball Valve,SW = 02 Nos

 6) 2" Butt Welded Valve ,300# = 3 Nos

 7) 2"Globe Valve,FE 300# =1 Nos

P.D.Patel
Petro Valves Pvt.Ltd.`;

function assertEqual(actual, expected, testName) {
  if (actual === expected) {
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}: Expected "${expected}", got "${actual}"`);
    process.exitCode = 1;
  }
}

console.log('=== RUNNING GLOBE VALVE SIZE EXTRACTION REGRESSION TEST ===\n');

// 1. Direct Pipeline Extraction Test on Item 7 text
const item7Text = '7) 2"Globe Valve,FE 300# =1 Nos';
const pipelineResult = extractionPipeline.processDocument(item7Text, {
  documentId: 'REGRESSION-TEST',
  documentType: 'EMAIL_BODY'
});

console.log('--- Deterministic Pipeline Output ---');
console.dir(pipelineResult.legacySpecifications);

assertEqual(pipelineResult.legacySpecifications.valve_size, '50', 'Pipeline extracts valve_size = "50" for 2"Globe Valve');
assertEqual(pipelineResult.legacySpecifications.valve_type, 'Globe Valve', 'Pipeline extracts valve_type = "Globe Valve"');
assertEqual(pipelineResult.legacySpecifications.valve_class, '300#', 'Pipeline extracts valve_class = "300#"');

console.log('\n--- End-to-End extractDynamicFields Test ---');
async function testDynamicFields() {
  const mockFieldDefs = [
    { fieldName: 'valve_size', fieldLabel: 'Valve Size', fieldType: 'Dropdown', options: ['15', '20', '25', '32', '40', '50', '65', '80', '100'] },
    { fieldName: 'valve_class', fieldLabel: 'Pressure Class', fieldType: 'Dropdown', options: ['150#', '300#', '600#', '800#'] },
    { fieldName: 'valve_type', fieldLabel: 'Valve Type', fieldType: 'Dropdown', options: ['Ball Valve', 'Gate Valve', 'Globe Valve', 'Check Valve'] }
  ];

  const dynResult = await aiService.extractDynamicFields(
    emailBody,
    mockFieldDefs,
    '2"Globe Valve,FE 300# =1 Nos',
    'TEST-ENQ'
  );

  console.log('Dynamic Fields Extracted:', dynResult);

  assertEqual(dynResult.valve_size?.value, '50', 'extractDynamicFields produces valve_size.value = "50"');
  assertEqual(dynResult.valve_type?.value, 'Globe Valve', 'extractDynamicFields produces valve_type.value = "Globe Valve"');
  assertEqual(dynResult.valve_class?.value, '300#', 'extractDynamicFields produces valve_class.value = "300#"');

  console.log('\n=== ALL REGRESSION TESTS COMPLETED SUCCESSFULLY ===');
}

testDynamicFields().catch(err => {
  console.error('Regression Test Error:', err);
  process.exitCode = 1;
});

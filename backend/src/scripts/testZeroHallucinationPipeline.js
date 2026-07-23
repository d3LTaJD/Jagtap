/**
 * Zero-Hallucination Pipeline Production Verification Script
 * Validates Phase 1, Phase 2, Phase 3, and Phase 4 components end-to-end.
 */

const extractionPipeline = require('../services/extraction/ExtractionPipeline');
const learningEngine = require('../services/extraction/LearningEngine');
const extractionMetrics = require('../services/extraction/ExtractionMetrics');
const { VALIDATION_STATES } = require('../types/EngineeringField');

console.log('================================================================');
console.log('   ZERO-HALLUCINATION AI EXTRACTION PIPELINE - FULL VERIFICATION');
console.log('================================================================\n');

// Sample Industrial Tender Datasheet Text
const sampleDatasheetText = `
PETRO VALVE INDUSTRIAL SYSTEMS - TECHNICAL RFQ SPECIFICATION SHEET
RFQ Ref: RFQ-PV-2026-8841

Item 01: Supply of 2" Ball Valve 300# Body: A105 as per API 6D. Qty: 25 Tag: XV-801 Dwg: DWG-4001 Pressure: 50 bar Temp: -46°C
Item 02: Supply of 3" Check Valve 600# Body: WCB as per BS 1868. Qty: 10 Tag: NRV-201 Dwg: DWG-4002 Pressure: 100 bar Temp: 200°C
`;

// 1. Process Document through Deterministic Pipeline
console.log('1. Processing Document Layout & Modular Extractors...');
const pipelineResult = extractionPipeline.processDocument(sampleDatasheetText, {
  documentId: 'RFQ-PV-2026-8841',
  documentType: 'VENDOR_DATASHEET'
});

console.log('\n--- EXTRACTED CANONICAL ENGINEERING FIELDS ---');
Object.values(pipelineResult.fields).forEach(field => {
  if (field.normalizedValue) {
    console.log(`  • ${field.fieldName.padEnd(22)}: "${field.normalizedValue}" [State: ${field.validationState}, Risk: ${field.score.risk}, Authority: ${field.score.authority}%]`);
  }
});

console.log('\n--- BACKWARDS COMPATIBILITY LEGACY SPECIFICATIONS MAP ---');
console.dir(pipelineResult.legacySpecifications, { depth: null });

// 2. Verify Zero-Hallucination Constraints
console.log('\n2. Verifying Zero-Hallucination Constraints...');
let passed = true;

function check(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
  } else {
    console.error(`❌ [FAIL] ${message}`);
    passed = false;
  }
}

check(pipelineResult.legacySpecifications.valve_size === '50', 'Size deterministically converted 2" -> 50mm');
check(pipelineResult.legacySpecifications.valve_class === '300#', 'Pressure Class normalized to ASME 300#');
check(pipelineResult.legacySpecifications.shellMaterial === 'ASTM A105', 'Material grade canonicalized to ASTM A105');
check(pipelineResult.legacySpecifications.valve_type === 'Ball Valve', 'Valve Type resolved to Ball Valve');
check(pipelineResult.legacySpecifications.designStandard === 'API 6D', 'Standard resolved to API 6D');
check(pipelineResult.legacySpecifications.quantity === '25', 'Quantity extracted as 25');
check(pipelineResult.legacySpecifications.tagNumber === 'XV-801', 'Tag Number extracted as XV-801');
check(pipelineResult.fields.valve_size.score.risk === 'LOW', 'Field Risk evaluated as LOW');

// 3. Verify Self-Learning Dynamic Alias Registration
console.log('\n3. Testing Self-Learning Engine Dynamic Alias Registration...');
learningEngine.recordCorrection({
  fieldCategory: 'material',
  rawToken: 'DUPLEX_2205',
  userSelectedCanonical: 'UNS S31803'
});

const learnedTestText = 'Supply of 4" Gate Valve 150# Body: DUPLEX_2205';
const learnedResult = extractionPipeline.processDocument(learnedTestText, {
  documentId: 'DOC-LEARNED',
  documentType: 'EMAIL_BODY'
});

check(learnedResult.legacySpecifications.shellMaterial === 'UNS S31803', 'Learned Alias "DUPLEX_2205" -> "UNS S31803" applied immediately in 0ms');

// 4. Print Pipeline Telemetry Metrics
console.log('\n4. Pipeline Telemetry Metrics Summary:');
console.dir(extractionMetrics.getSummary());

console.log('\n================================================================');
if (passed) {
  console.log('  🎯 ALL ZERO-HALLUCINATION EXTRACTION PIPELINE TESTS PASSED!');
} else {
  console.error('  ⚠️ SOME PIPELINE TESTS FAILED!');
  process.exitCode = 1;
}
console.log('================================================================\n');

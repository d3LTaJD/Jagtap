/**
 * Phase 4 & End-to-End Pipeline Unit Test Verification Script
 * Tests LearningEngine, ExtractionMetrics, and full ExtractionPipeline.
 */

const learningEngine = require('../services/extraction/LearningEngine');
const extractionMetrics = require('../services/extraction/ExtractionMetrics');
const extractionPipeline = require('../services/extraction/ExtractionPipeline');

function assertEqual(actual, expected, testName) {
  if (actual === expected) {
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}: Expected "${expected}", got "${actual}"`);
    process.exitCode = 1;
  }
}

console.log('=== RUNNING PHASE 4 & END-TO-END PIPELINE TESTS ===\n');

// 1. Test LearningEngine
const learnRes = learningEngine.recordCorrection({
  fieldCategory: 'material',
  rawToken: 'SUPER_DUPLEX_2507',
  userSelectedCanonical: 'UNS S32750',
  userId: 'USER-101'
});
assertEqual(learnRes.success, true, 'LearningEngine recordCorrection success');
assertEqual(learningEngine.getHistory().length, 1, 'LearningEngine history count');

// 2. Test Full ExtractionPipeline
const sampleRFQ = `
PETRO VALVE RFQ SPECIFICATION SHEET
Document ID: RFQ-2026-991
Item 1: Supply of 2" Ball Valve 300# Body: A105 as per API 6D. Qty: 15 Tag: XV-901 Dwg: DWG-1002 Pressure: 50 bar Temp: -46°C
`;

const result = extractionPipeline.processDocument(sampleRFQ, {
  documentId: 'RFQ-2026-991',
  documentType: 'PURCHASE_RFQ'
});

assertEqual(result.documentId, 'RFQ-2026-991', 'ExtractionPipeline documentId');
assertEqual(result.legacySpecifications.valve_size, '50', 'ExtractionPipeline valve_size 2" -> 50');
assertEqual(result.legacySpecifications.valve_class, '300#', 'ExtractionPipeline valve_class 300#');
assertEqual(result.legacySpecifications.shellMaterial, 'ASTM A105', 'ExtractionPipeline shellMaterial ASTM A105');
assertEqual(result.legacySpecifications.valve_type, 'Ball Valve', 'ExtractionPipeline valve_type Ball Valve');
assertEqual(result.legacySpecifications.designStandard, 'API 6D', 'ExtractionPipeline designStandard API 6D');
assertEqual(result.legacySpecifications.quantity, '15', 'ExtractionPipeline quantity 15');
assertEqual(result.legacySpecifications.tagNumber, 'XV-901', 'ExtractionPipeline tagNumber XV-901');

// 3. Test ExtractionMetrics
const metrics = extractionMetrics.getSummary();
assertEqual(metrics.totalRuns >= 1, true, 'ExtractionMetrics recorded runs');
assertEqual(metrics.accuracyPercentage > 0, true, 'ExtractionMetrics calculated accuracy');

console.log('\n=== ALL PHASE 4 & END-TO-END PIPELINE TESTS COMPLETED ===');

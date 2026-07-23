/**
 * Phase 1 Unit Test Verification Script
 * Tests EngineeringField, KnowledgeEngine, ExtractorRegistry, and modular extractors.
 */

const { createEngineeringField, VALIDATION_STATES } = require('../types/EngineeringField');
const knowledgeEngine = require('../services/extraction/KnowledgeEngine');
const extractorRegistry = require('../services/extraction/ExtractorRegistry');
const normalizationService = require('../services/extraction/NormalizationService');

function assertEqual(actual, expected, testName) {
  if (actual === expected) {
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}: Expected "${expected}", got "${actual}"`);
    process.exitCode = 1;
  }
}

console.log('=== RUNNING PHASE 1 EXTRACTION PIPELINE TESTS ===\n');

// 1. Test EngineeringField factory
const field = createEngineeringField({
  fieldId: 'valve_size',
  fieldName: 'Valve Size (DN)',
  rawValue: '3/4"',
  normalizedValue: '20',
  validationState: VALIDATION_STATES.VALID
});
assertEqual(field.fieldId, 'valve_size', 'EngineeringField fieldId');
assertEqual(field.normalizedValue, '20', 'EngineeringField normalizedValue');
assertEqual(field.score.confidence, 0, 'EngineeringField default score confidence');

// 2. Test KnowledgeEngine Normalization
assertEqual(knowledgeEngine.normalizeSize('3/4"'), '20', 'KnowledgeEngine size normalization 3/4" -> 20');
assertEqual(knowledgeEngine.normalizeSize('2"'), '50', 'KnowledgeEngine size normalization 2" -> 50');
assertEqual(knowledgeEngine.normalizeClass('CL 300'), '300#', 'KnowledgeEngine class normalization CL 300 -> 300#');
assertEqual(knowledgeEngine.normalizeEndConnection('BW ENDS'), 'Butt Weld', 'KnowledgeEngine connection normalization BW ENDS -> Butt Weld');
assertEqual(knowledgeEngine.normalizeMaterial('A105'), 'ASTM A105', 'KnowledgeEngine material normalization A105 -> ASTM A105');
assertEqual(knowledgeEngine.normalizeValveType('Ball Valve'), 'Ball Valve', 'KnowledgeEngine valve type normalization Ball Valve -> Ball Valve');

// 3. Test NormalizationService
assertEqual(normalizationService.normalizeField('valve_size', '1"'), '25', 'NormalizationService valve_size 1" -> 25');
assertEqual(normalizationService.normalizeField('valve_class', '600#'), '600#', 'NormalizationService valve_class 600# -> 600#');

// 4. Test ExtractorRegistry with sample text
const sampleText = 'RF TENDER: Supply of 2" Ball Valve 300# Body: A105 as per API 6D. Qty: 10 Tag: XV-101 Dwg: DWG-502 Pressure: 50 bar Temp: -46°C';
const extractions = extractorRegistry.runAll(sampleText);

assertEqual(extractions.SizeExtractor?.normalizedValue, '50', 'SizeExtractor extracted 2" -> 50');
assertEqual(extractions.ClassExtractor?.normalizedValue, '300#', 'ClassExtractor extracted 300# -> 300#');
assertEqual(extractions.MaterialExtractor?.normalizedValue, 'ASTM A105', 'MaterialExtractor extracted A105 -> ASTM A105');
assertEqual(extractions.ValveExtractor?.normalizedValue, 'Ball Valve', 'ValveExtractor extracted Ball Valve -> Ball Valve');
assertEqual(extractions.StandardExtractor?.normalizedValue, 'API 6D', 'StandardExtractor extracted API 6D -> API 6D');
assertEqual(extractions.QuantityExtractor?.normalizedValue, '10', 'QuantityExtractor extracted Qty: 10 -> 10');
assertEqual(extractions.TagExtractor?.normalizedValue, 'XV-101', 'TagExtractor extracted Tag: XV-101 -> XV-101');
assertEqual(extractions.DrawingExtractor?.normalizedValue, 'DWG-502', 'DrawingExtractor extracted Dwg: DWG-502 -> DWG-502');
assertEqual(extractions.PressureExtractor?.normalizedValue, '50 bar', 'PressureExtractor extracted Pressure: 50 bar -> 50 bar');
assertEqual(extractions.TemperatureExtractor?.normalizedValue, '-46°C', 'TemperatureExtractor extracted Temp: -46°C -> -46°C');

console.log('\n=== ALL PHASE 1 EXTRACTION PIPELINE TESTS COMPLETED ===');

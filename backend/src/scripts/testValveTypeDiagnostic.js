/**
 * Diagnostic Script: Valve Type Extraction Trace
 * 
 * Traces how '8" Gate Valve Class 150 Qty 20' moves through:
 * 1. ValveExtractor plugin
 * 2. ExtractionPipeline
 * 3. NormalizationService
 * 4. aiService prompt & overlay
 */

const valveExtractor = require('../services/extraction/extractors/ValveExtractor');
const extractionPipeline = require('../services/extraction/ExtractionPipeline');
const normalizationService = require('../services/extraction/NormalizationService');

console.log('=== TEST 1: ValveExtractor plugin ===');
const res1 = valveExtractor.extract('8" Gate Valve Class 150 Qty 20');
console.log('ValveExtractor result:', JSON.stringify(res1, null, 2));

console.log('\n=== TEST 2: ExtractionPipeline ===');
const res2 = extractionPipeline.processDocument('8" Gate Valve Class 150 Qty 20');
console.log('ExtractionPipeline legacySpecifications:', JSON.stringify(res2.legacySpecifications, null, 2));

console.log('\n=== TEST 3: NormalizationService ===');
const dummyFieldsDef = [
  { fieldName: 'valve_type', fieldLabel: 'Valve Type', fieldType: 'Dropdown', options: ['Ball Valve', 'Gate Valve', 'Globe Valve', 'Check Valve', 'Butterfly Valve'] }
];
const rawFields = {
  valve_type: { value: 'Gate Valve', confidence: 100 }
};
const res3 = normalizationService.normalizeExtractedFields(rawFields, dummyFieldsDef);
console.log('NormalizationService result:', JSON.stringify(res3, null, 2));

/**
 * Verification Test: Gate Valve Extraction & Normalization
 * 
 * Verifies that '8" Gate Valve Class 150 Qty 20' is correctly extracted
 * as Valve Type = "Gate Valve", Size = "200", Class = "150#", Qty = 20.
 * 
 * Usage: node src/scripts/testGateValveClassification.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const FieldDefinition = require('../models/FieldDefinition');
const extractionPipeline = require('../services/extraction/ExtractionPipeline');
const normalizationService = require('../services/extraction/NormalizationService');
const aiService = require('../services/aiService');

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function testGateValve() {
  console.log('\n======================================================');
  console.log('🧪 TESTING GATE VALVE CLASSIFICATION & EXTRACTION');
  console.log('======================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB...');

  const text = '8" Gate Valve Class 150 Qty 20';

  // 1. Test ExtractionPipeline
  console.log('\n1. Testing ExtractionPipeline...');
  const pipeRes = extractionPipeline.processDocument(text);
  const legacySpecs = pipeRes.legacySpecifications;
  console.log('   Legacy Specifications:', JSON.stringify(legacySpecs, null, 2));

  assert(legacySpecs.valve_type === 'Gate Valve', 'ExtractionPipeline detects valve_type = "Gate Valve"');
  assert(legacySpecs.valve_size === '200', 'ExtractionPipeline detects valve_size = "200" (8")');
  assert(legacySpecs.valve_class === '150#', 'ExtractionPipeline detects valve_class = "150#"');

  // 2. Test NormalizationService with DB FieldDefinitions
  console.log('\n2. Testing NormalizationService against DB FieldDefinitions...');
  const fields = await FieldDefinition.find({
    formContext: 'Enquiry',
    isDeleted: false,
    isActive: true
  });

  const rawFields = {
    valve_type: { value: 'Gate Valve', confidence: 100 },
    valve_size: { value: '200', confidence: 100 },
    valve_class: { value: '150#', confidence: 100 }
  };

  const normRes = normalizationService.normalizeExtractedFields(rawFields, fields);
  console.log('   Normalized Result for valve_type:', JSON.stringify(normRes.valve_type, null, 2));

  assert(normRes.valve_type?.value === 'Gate Valve', 'NormalizationService keeps valve_type = "Gate Valve"');
  assert(normRes.valve_size?.value === '200', 'NormalizationService keeps valve_size = "200"');
  assert(normRes.valve_class?.value === '150#', 'NormalizationService keeps valve_class = "150#"');

  // 3. Test aiService.extractDynamicFields with DB FieldDefinitions
  console.log('\n3. Testing aiService.extractDynamicFields...');
  const dynRes = await aiService.extractDynamicFields(text, fields, text, 'TEST-ENQ');
  console.log('   extractDynamicFields valve_type:', JSON.stringify(dynRes.valve_type, null, 2));

  assert(dynRes.valve_type?.value === 'Gate Valve', 'extractDynamicFields extracts valve_type = "Gate Valve"');

  await mongoose.disconnect();
  console.log('\n======================================================');
  console.log('🎉 ALL GATE VALVE CLASSIFICATION TESTS PASSED!');
  console.log('======================================================\n');
}

testGateValve().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});

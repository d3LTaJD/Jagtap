/**
 * Phase 2 Unit Test Verification Script
 * Tests DocumentLayoutEngine, ProductIdentity, and EvidenceEngine.
 */

const documentLayoutEngine = require('../services/extraction/DocumentLayoutEngine');
const productIdentity = require('../services/extraction/ProductIdentity');
const EvidenceEngine = require('../services/extraction/EvidenceEngine');

function assertEqual(actual, expected, testName) {
  if (actual === expected) {
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}: Expected "${expected}", got "${actual}"`);
    process.exitCode = 1;
  }
}

console.log('=== RUNNING PHASE 2 PIPELINE TESTS ===\n');

// 1. Test DocumentLayoutEngine
const sampleDocText = `--- Page 1 ---
PETRO VALVE SPECIFICATION
Tag: XV-101 | Size: 2" | Class: 300# | Material: A105
Tag: XV-102 | Size: 3" | Class: 600# | Material: WCB
`;

const layout = documentLayoutEngine.parseLayout(sampleDocText, 'DOC-1001');
assertEqual(layout.documentId, 'DOC-1001', 'DocumentLayoutEngine documentId');
assertEqual(layout.pages.length, 1, 'DocumentLayoutEngine pages count');
assertEqual(layout.pages[0].tables.length, 1, 'DocumentLayoutEngine table detection count');
assertEqual(layout.pages[0].tables[0].rows.length, 2, 'DocumentLayoutEngine table row count');

// 2. Test ProductIdentity
const identityA = productIdentity.generateIdentity({
  documentId: 'DOC-1001',
  pageNumber: 1,
  tableId: 'TBL-1-1',
  rowIndex: 1,
  itemNumber: 1,
  rawDescription: 'Ball Valve 2" 300#',
  specifications: { valve_size: '50', valve_class: '300#', shellMaterial: 'ASTM A105' }
});

const identityB = productIdentity.generateIdentity({
  documentId: 'DOC-1001',
  pageNumber: 1,
  tableId: 'TBL-1-1',
  rowIndex: 2,
  itemNumber: 2,
  rawDescription: 'Ball Valve 2" 300# SS316',
  specifications: { valve_size: '50', valve_class: '300#', shellMaterial: 'SS316' }
});

assertEqual(productIdentity.canMerge(identityA, identityB), false, 'ProductIdentity prevents merging distinct items');
assertEqual(productIdentity.canMerge(identityA, identityA), true, 'ProductIdentity self-merge is true');

// 3. Test EvidenceEngine
const evidenceEngine = new EvidenceEngine();
evidenceEngine.addEvidence('valve_class', {
  documentType: 'VENDOR_DATASHEET',
  normalizedValue: '300#'
});
evidenceEngine.addEvidence('valve_class', {
  documentType: 'BOQ',
  normalizedValue: '300#'
});
evidenceEngine.addEvidence('valve_class', {
  documentType: 'ENGINEERING_DRAWING',
  normalizedValue: '600#'
});

const evaluation = evidenceEngine.evaluateFieldEvidence('valve_class');
assertEqual(evaluation.consensusValue, '300#', 'EvidenceEngine consensus value 300#');
assertEqual(evaluation.highestAuthority, 100, 'EvidenceEngine highest authority 100');
assertEqual(evaluation.agreementScore, 67, 'EvidenceEngine agreement score 67% (2 out of 3)');

console.log('\n=== ALL PHASE 2 PIPELINE TESTS COMPLETED ===');

const assert = require('assert');
const { generateQuotationPricingWorkbook } = require('../services/quotationExcelExportService');
const { parseAndValidatePricingSpreadsheet } = require('../services/quotationExcelImportService');
const { applyBulkPricing, applySelectiveSpecCloning } = require('../services/quotationBulkService');

console.log('='.repeat(80));
console.log('RUNNING UNIT TESTS FOR EXCEL IMPORT/EXPORT & BULK SERVICES');
console.log('='.repeat(80));

// Mock 5-item quotation
const mockQuotation = {
  quotationId: 'QT-2026-08-0099',
  customerName: 'Reliance Industries Ltd',
  projectName: 'Jamnagar Refinery Expansion',
  items: [
    {
      _id: '64a000000000000000000001',
      lineItemId: 'LI-00001',
      itemNo: 1,
      enquirySrNo: 1,
      description: '2" Ball Valve 150# WCB',
      size: '50 mm',
      pressureClass: '150#',
      productCategory: 'Ball Valve',
      materialGrade: 'ASTM A216 WCB',
      quantity: 10,
      unit: 'NOS',
      unitPrice: 5000,
      discountPercent: 5,
      ndtCharges: 200,
      dynamicFields: {
        valve_type: 'Ball Valve',
        valve_size: '50 mm',
        valve_class: '150#',
        valve_body_moc: 'ASTM A216 WCB',
        test_rt: '100% Full RT',
        annex_c: 'Yes'
      }
    },
    {
      _id: '64a000000000000000000002',
      lineItemId: 'LI-00002',
      itemNo: 2,
      enquirySrNo: 2,
      description: '4" Ball Valve 300# WCB',
      size: '100 mm',
      pressureClass: '300#',
      productCategory: 'Ball Valve',
      materialGrade: 'ASTM A216 WCB',
      quantity: 5,
      unit: 'NOS',
      unitPrice: 12000,
      discountPercent: 0,
      dynamicFields: {
        valve_type: 'Ball Valve',
        valve_size: '100 mm',
        valve_class: '300#',
        valve_body_moc: 'ASTM A216 WCB'
      }
    },
    {
      _id: '64a000000000000000000003',
      lineItemId: 'LI-00003',
      itemNo: 3,
      enquirySrNo: 3,
      description: '6" Gate Valve 150# CF8M',
      size: '150 mm',
      pressureClass: '150#',
      productCategory: 'Gate Valve',
      materialGrade: 'ASTM A351 CF8M',
      quantity: 2,
      unit: 'NOS',
      unitPrice: 25000,
      discountPercent: 10,
      dynamicFields: {
        valve_type: 'Gate Valve',
        valve_size: '150 mm',
        valve_class: '150#',
        valve_body_moc: 'ASTM A351 CF8M'
      }
    }
  ]
};

// TEST 1: Excel Export
console.log('\n[TEST 1] Testing Excel Export Generation...');
const xlsxBuffer = generateQuotationPricingWorkbook(mockQuotation);
assert(Buffer.isBuffer(xlsxBuffer) && xlsxBuffer.length > 1000, 'Export must return a valid XLSX buffer');
console.log('✓ Excel export generated valid buffer of size:', xlsxBuffer.length, 'bytes');

// TEST 2: Excel Import & Validation of Exported File
console.log('\n[TEST 2] Testing Excel Import and Round-Trip Validation...');
const importResult = parseAndValidatePricingSpreadsheet(xlsxBuffer, mockQuotation);
assert.strictEqual(importResult.isValid, true, 'Exported sheet should pass validation cleanly');
assert.strictEqual(importResult.updatedCount, 3, 'Should match all 3 items');
assert.strictEqual(importResult.requiresPartialConfirmation, false, 'Full import should not require partial confirmation');
console.log('✓ Excel import verified: 3 items matched strictly by lineItemId');

// TEST 3: Partial Import Detection
console.log('\n[TEST 3] Testing Partial Import Protection (Missing Row Detection)...');
const XLSX = require('xlsx');
const wb = XLSX.read(xlsxBuffer, { type: 'buffer' });
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
// Remove the last data row (item #3)
data.pop();
const partialWs = XLSX.utils.aoa_to_sheet(data);
const partialWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(partialWb, partialWs, 'Price Part-II');
const partialBuffer = XLSX.write(partialWb, { type: 'buffer', bookType: 'xlsx' });

const partialResult = parseAndValidatePricingSpreadsheet(partialBuffer, mockQuotation);
assert.strictEqual(partialResult.requiresPartialConfirmation, true, 'Should trigger partial import confirmation');
assert.strictEqual(partialResult.missingItemIds.length, 1, 'Should identify 1 missing item');
assert.strictEqual(partialResult.missingItemIds[0].lineItemId, 'LI-00003', 'Missing item must be LI-00003');
console.log('✓ Partial import protection caught missing item:', partialResult.missingItemIds[0].lineItemId);

// TEST 4: Selective Specification Cloning (Safe Cloning)
console.log('\n[TEST 4] Testing Safe Selective Specification Cloning...');
const clonedItems = applySelectiveSpecCloning(mockQuotation.items, {
  sourceIndex: 0,
  targetScope: 'same_type', // Only copy to Ball Valves (Item #2), Gate Valve (Item #3) is excluded
  categories: {
    testing: true,
    annexures: true,
    moc: false,
    common_specs: false
  }
});

// Check that Item #2 received testing and annexures from Item #1
assert.strictEqual(clonedItems[1].dynamicFields.test_rt, '100% Full RT', 'Item #2 should receive test_rt from Item #1');
assert.strictEqual(clonedItems[1].dynamicFields.annex_c, 'Yes', 'Item #2 should receive annex_c from Item #1');
// Check that Item #2 INTRINSIC fields were NOT overwritten
assert.strictEqual(clonedItems[1].size, '100 mm', 'Item #2 size must remain 100 mm');
assert.strictEqual(clonedItems[1].pressureClass, '300#', 'Item #2 pressureClass must remain 300#');
assert.strictEqual(clonedItems[1].quantity, 5, 'Item #2 quantity must remain 5');
// Check that Gate Valve (Item #3) was untouched because targetScope was 'same_type'
assert.strictEqual(clonedItems[2].dynamicFields.test_rt, undefined, 'Item #3 (Gate Valve) should not be modified');
console.log('✓ Selective spec cloning successfully preserved intrinsic properties and respected scope filters!');

// TEST 5: Bulk Pricing Updates
console.log('\n[TEST 5] Testing Bulk Pricing Operations...');
// Apply 15% discount to items 0 and 1
const discountedItems = applyBulkPricing(mockQuotation.items, {
  targetIndices: [0, 1],
  action: 'set_discount',
  value: 15
});

assert.strictEqual(discountedItems[0].discountPercent, 15, 'Item #1 discount should be 15%');
assert.strictEqual(discountedItems[1].discountPercent, 15, 'Item #2 discount should be 15%');
assert.strictEqual(discountedItems[2].discountPercent, 10, 'Item #3 discount should remain 10%');
console.log('✓ Bulk pricing accurately applied to selected subsets!');

console.log('\n' + '='.repeat(80));
console.log('ALL EXCEL & BULK TESTS PASSED 100%!');
console.log('='.repeat(80));

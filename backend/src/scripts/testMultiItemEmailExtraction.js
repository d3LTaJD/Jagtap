const assert = require('assert');
const { parseEmailBodyLineItems } = require('../services/boqParserService');
const extractionPipeline = require('../services/extraction/ExtractionPipeline');

const sampleMultiItemEmail = `Dear Team,

Please quote for the following valves on urgent basis:

1. 50 NB Class 150 Ball Valve (Qty: 10 Nos)
2. 80 NB Class 300 Gate Valve - 5 Nos
3. 100 NB Class 150 Check Valve (Qty: 2 Nos)
4. 2" 150# Globe Valve, Manual - Qty 4 Nos
5. 6" 300# Ball Valve, Gear Operated - 2 Nos
6. 150 NB 150# Butterfly Valve (Qty: 6 Nos)

Common Technical Requirements:
Body MOC: ASTM A216 WCB
End Connection: Flanged RF
Design Standard: API 6D
Testing Standard: API 6D
Testing: Hydro Shell & Seat test, EN 10204 3.1 MTC required.

Thanks & Regards,
Procurement Team
`;

async function runMultiItemTest() {
  console.log('\n' + '='.repeat(80));
  console.log('TESTING REAL-WORLD MULTI-ITEM EMAIL EXTRACTION (6 ITEMS)');
  console.log('='.repeat(80));

  // Step 1: Parse line items from email text
  const products = parseEmailBodyLineItems(sampleMultiItemEmail);
  console.log(`\nStep 1: Extracted Products count: ${products.length} (Expected: 6)`);
  assert.strictEqual(products.length, 6, 'Must parse exactly 6 products');

  const expectedSpecs = [
    { size: '50 mm', class: '150#', type: 'Ball Valve', qty: 10 },
    { size: '80 mm', class: '300#', type: 'Gate Valve', qty: 5 },
    { size: '100 mm', class: '150#', type: 'Check Valve', qty: 2 },
    { size: '50 mm', class: '150#', type: 'Globe Valve', qty: 4 },
    { size: '150 mm', class: '300#', type: 'Ball Valve', qty: 2 },
    { size: '150 mm', class: '150#', type: 'Butterfly Valve', qty: 6 }
  ];

  console.log('\nStep 2: Checking Line Item Specifications & Common Inheritance:');
  const mockFieldDefs = [
    { fieldName: 'valve_type' },
    { fieldName: 'valve_size' },
    { fieldName: 'valve_class' },
    { fieldName: 'quantity' },
    { fieldName: 'valve_moc_body' },
    { fieldName: 'valve_end_connection' },
    { fieldName: 'valve_operating' }
  ];

  for (let i = 0; i < products.length; i++) {
    const prod = products[i];
    const exp = expectedSpecs[i];

    const gatedResult = await extractionPipeline.processProductGatedPipeline({
      textContext: sampleMultiItemEmail,
      fieldDefinitions: mockFieldDefs,
      productDescription: prod.productDescription,
      enquiryId: 'test-enq-001',
      productIndex: i,
      lineItemId: `LI-${i + 1}`
    });

    const dynFields = gatedResult.validatedDynamicFields;
    console.log(`\n  Item ${i + 1}: "${prod.productDescription}"`);
    console.log(`    Size:     ${dynFields.valve_size} (Expected: ${exp.size})`);
    console.log(`    Class:    ${dynFields.valve_class} (Expected: ${exp.class})`);
    console.log(`    Type:     ${dynFields.valve_type} (Expected: ${exp.type})`);
    console.log(`    Qty:      ${prod.quantity} (Expected: ${exp.qty})`);
    console.log(`    MOC:      ${dynFields.valve_moc_body} (Inherited from context)`);
    console.log(`    End Conn: ${dynFields.valve_end_connection} (Inherited from context)`);

    assert.strictEqual(dynFields.valve_size, exp.size, `Item ${i + 1} size mismatch`);
    assert.strictEqual(dynFields.valve_class, exp.class, `Item ${i + 1} class mismatch`);
    assert.strictEqual(dynFields.valve_type, exp.type, `Item ${i + 1} valve type mismatch`);
    assert.strictEqual(prod.quantity, exp.qty, `Item ${i + 1} quantity mismatch`);
    assert.strictEqual(dynFields.valve_moc_body, 'ASTM A216 WCB', `Item ${i + 1} MOC mismatch`);
    assert.strictEqual(dynFields.valve_end_connection, 'Flanged RF', `Item ${i + 1} End Connection mismatch`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('ALL 6 MULTI-ITEM EMAIL EXTRACTION ASSERTIONS PASSED PERFECTLY!');
  console.log('='.repeat(80));
}

runMultiItemTest().catch(err => {
  console.error('Multi-item test failed:', err);
  process.exit(1);
});

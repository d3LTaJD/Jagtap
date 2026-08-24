const assert = require('assert');
const { parseEmailBodyLineItems } = require('../services/boqParserService');
const extractionPipeline = require('../services/extraction/ExtractionPipeline');

const horizonEmailText = `To: Sales Team / Petro Valves Pvt. Ltd.
Dear Sir,
We acknowledge your technical capabilities and request you to submit your most competitive technical and commercial quotation for the supply of valves for our upcoming Horizon Refinery Expansion Project.
Please find the detailed line items and technical specifications below:
---------------------------------------------------------------------------------------------------
LINE ITEM SPECIFICATIONS:
---------------------------------------------------------------------------------------------------
Item 01: API 6D Floating Ball Valve
- Size: 2" (50 MM)
- Pressure Class: 150#
- Body MOC: ASTM A216 Gr. WCB
- Trim MOC: 13% Cr. STEEL (SS410)
- Seat MOC: PTFE
- End Connection: Flanged RF (ASME B16.5)
- Quantity: 5 Nos.

Item 02: API 6D Trunnion Mounted Ball Valve (TMBV)
- Size: 6" (150 MM)
- Pressure Class: 300#
- Body MOC: ASTM A216 Gr. WCB
- Ball MOC: ASTM A182 Gr. F316
- Stem MOC: ASTM A182 Gr. F316
- Seat MOC: RPTFE + ASTM A182 Gr. F6a CL.1
- Feature: DBB Hydro Seat Test Required
- Quantity: 2 Nos.

Item 03: Swing Check Valve (API 6D / API 598)
- Size: 4" (100 MM)
- Pressure Class: 150#
- Body MOC: ASTM A216 Gr. WCB
- Disc/Trim MOC: 13% Cr. STEEL
- End Connection: Flanged RF
- Quantity: 4 Nos.

Item 04: Forged Steel Lift Check Valve (BS 1868 / API 598)
- Size: 1" (25 MM)
- Pressure Class: 800#
- Body MOC: ASTM A105
- Trim MOC: ASTM A182 Gr. F6a CL.1
- End Connection: Socket Weld (SW) with Pups
- Quantity: 10 Nos.

Item 05: API 600 Gate Valve
- Size: 8" (200 MM)
- Pressure Class: 300#
- Body MOC: ASTM A216 Gr. WCB
- Wedge MOC: ASTM A216 Gr. WCB + 13% Cr.
- Stem MOC: ASTM A182 Gr. F6a CL.2
- End Connection: Flanged RF
- Quantity: 3 Nos.

Item 06: Globe Valve (BS 1873 / API 600)
- Size: 2" (50 MM)
- Pressure Class: 150#
- Body MOC: ASTM A216 Gr. WCB
- Disc MOC: 13% Cr. STEEL
- Stem MOC: ASTM A479 Gr. SS304
- Painting: 120 Micron DFT (Standard)
- Quantity: 6 Nos.
---------------------------------------------------------------------------------------------------
COMMERCIAL & GENERAL TERMS REQUIRED:
---------------------------------------------------------------------------------------------------
1. Inspection: EN 10204 3.2 Material Test Certificates required.
2. Packing & Forwarding: 5% extra.
3. 3.2 Certification: 5% extra.
4. TPIA: Third-Party Inspection to client account.
5. GST: 18% Applicable.
6. Offer Validity: 30 days.

Kindly confirm receipt and provide your formal quotation (Technical Part-I, Contract Review Checklist, and Price Part-II).

Thanks & Regards,
Jayesh Patel
Senior Procurement Engineer
Horizon Project Solutions Ltd.
`;

async function runHorizonTest() {
  console.log('\n' + '='.repeat(80));
  console.log('TESTING HORIZON MULTI-ITEM RFQ EXTRACTION (6 ITEMS - BLOCK FORMAT)');
  console.log('='.repeat(80));

  const products = parseEmailBodyLineItems(horizonEmailText);
  console.log(`\nProducts Extracted: ${products.length} (Expected: 6)`);
  assert.strictEqual(products.length, 6, 'Must extract exactly 6 line items');

  const expected = [
    { size: '50 mm', class: '150#', type: 'Floating Ball Valve', qty: 5, moc: 'ASTM A216 WCB', ends: 'Flanged RF' },
    { size: '150 mm', class: '300#', type: 'Trunnion Mounted Ball Valve', qty: 2, moc: 'ASTM A216 WCB' },
    { size: '100 mm', class: '150#', type: 'Swing Check Valve', qty: 4, moc: 'ASTM A216 WCB', ends: 'Flanged RF' },
    { size: '25 mm', class: '800#', type: 'Lift Check Valve', qty: 10, moc: 'ASTM A105', ends: 'Socket Weld' },
    { size: '200 mm', class: '300#', type: 'Gate Valve', qty: 3, moc: 'ASTM A216 WCB', ends: 'Flanged RF' },
    { size: '50 mm', class: '150#', type: 'Globe Valve', qty: 6, moc: 'ASTM A216 WCB' }
  ];

  const mockFieldDefs = [
    { fieldName: 'valve_type' },
    { fieldName: 'valve_size' },
    { fieldName: 'valve_class' },
    { fieldName: 'quantity' },
    { fieldName: 'valve_moc_body' },
    { fieldName: 'valve_end_connection' }
  ];

  for (let i = 0; i < products.length; i++) {
    const prod = products[i];
    const exp = expected[i];

    const gatedResult = await extractionPipeline.processProductGatedPipeline({
      textContext: horizonEmailText,
      fieldDefinitions: mockFieldDefs,
      productDescription: prod.productDescription,
      enquiryId: 'enq-horizon-001',
      productIndex: i,
      lineItemId: `LI-00${i + 1}`
    });

    const dyn = gatedResult.validatedDynamicFields;
    console.log(`\n  Item ${i + 1}:`);
    console.log(`    Desc:     ${prod.productDescription}`);
    console.log(`    Size:     ${dyn.valve_size} (Expected: ${exp.size})`);
    console.log(`    Class:    ${dyn.valve_class} (Expected: ${exp.class})`);
    console.log(`    Type:     ${dyn.valve_type} (Expected: ${exp.type})`);
    console.log(`    Qty:      ${prod.quantity} (Expected: ${exp.qty})`);
    console.log(`    MOC:      ${dyn.valve_moc_body}`);
    console.log(`    End Conn: ${dyn.valve_end_connection}`);

    assert.strictEqual(dyn.valve_size, exp.size, `Item ${i + 1} size mismatch`);
    assert.strictEqual(dyn.valve_class, exp.class, `Item ${i + 1} class mismatch`);
    assert.strictEqual(dyn.valve_type, exp.type, `Item ${i + 1} valve type mismatch`);
    assert.strictEqual(prod.quantity, exp.qty, `Item ${i + 1} quantity mismatch`);
    if (exp.moc) assert.strictEqual(dyn.valve_moc_body, exp.moc, `Item ${i + 1} MOC mismatch`);
    if (exp.ends) assert.strictEqual(dyn.valve_end_connection, exp.ends, `Item ${i + 1} ends mismatch`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('ALL 6 HORIZON MULTI-LINE SPECIFICATION ITEMS PASSED 100% PERFECTLY!');
  console.log('='.repeat(80));
}

runHorizonTest().catch(err => {
  console.error('Horizon test failed:', err);
  process.exit(1);
});

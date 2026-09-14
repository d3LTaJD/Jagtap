const boqParserService = require('../services/boqParserService');
const extractionPipeline = require('../services/extraction/ExtractionPipeline');
const FieldDefinition = require('../models/FieldDefinition');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const text = `Item 01: API 6D Floating Ball Valve
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
- Quantity: 6 Nos.`;

async function testTrace() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const products = boqParserService.parseEmailBodyLineItems(text);
  console.log('\n--- 1. boqParserService.parseEmailBodyLineItems output:');
  products.forEach((p, i) => {
    console.log(`\nProduct ${i + 1}:`);
    console.log('description:', p.productDescription);
    console.log('qty:', p.quantity);
  });

  const fields = await FieldDefinition.find({
    formContext: 'Enquiry',
    isDeleted: false,
    isActive: true,
    productCategory: 'Valves'
  });
  console.log(`\nFound ${fields.length} FieldDefinitions for Valves`);

  for (let i = 0; i < products.length; i++) {
    const prod = products[i];
    const gatedResult = await extractionPipeline.processProductGatedPipeline({
      textContext: text,
      fieldDefinitions: fields,
      productDescription: prod.productDescription,
      enquiryId: null,
      productIndex: i,
      lineItemId: `LI-00${i + 1}`
    });

    console.log(`\n--- 2. gatedResult for Product ${i + 1}:`);
    console.log('validatedDynamicFields:', gatedResult.validatedDynamicFields);
  }

  await mongoose.disconnect();
}

testTrace().catch(console.error);

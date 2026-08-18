const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const MasterData = require('../models/MasterData');
const FieldDefinition = require('../models/FieldDefinition');

async function checkGlobeValveSpecs() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  // 1. Check Sizes
  const sizeMaster = await MasterData.findOne({ slug: 'size' }).lean();
  const dbSizes = sizeMaster ? sizeMaster.items || [] : [];
  
  const expectedSizes = [
    { inch: '1/2"', dn: '015', label: '1/2"' },
    { inch: '3/4"', dn: '020', label: '3/4"' },
    { inch: '1"', dn: '025', label: '1"' },
    { inch: '1-1/4"', dn: '032', label: '1-1/4"' },
    { inch: '1-1/2"', dn: '040', label: '1-1/2"' },
    { inch: '2"', dn: '050', label: '2"' },
    { inch: '2-1/2"', dn: '065', label: '065' },
    { inch: '3"', dn: '080', label: '3"' },
    { inch: '4"', dn: '100', label: '4"' },
    { inch: '6"', dn: '150', label: '6"' },
    { inch: '8"', dn: '200', label: '8"' },
    { inch: '10"', dn: '250', label: '10"' },
    { inch: '12"', dn: '300', label: '12"' },
    { inch: '14"', dn: '350', label: '14"' },
    { inch: '16"', dn: '400', label: '16"' },
    { inch: '18"', dn: '450', label: '18"' },
    { inch: '20"', dn: '500', label: '20"' },
    { inch: '22"', dn: '550', label: '550' },
    { inch: '24"', dn: '600', label: '24"' },
    { inch: '26"', dn: '650', label: '26"' },
    { inch: '28"', dn: '700', label: '28"' },
    { inch: '30"', dn: '750', label: '30"' },
    { inch: '32"', dn: '800', label: '32"' },
    { inch: '34"', dn: '850', label: '850' },
    { inch: '36"', dn: '900', label: '36"' },
    { inch: '38"', dn: '950', label: '950' },
    { inch: '40"', dn: '1000', label: '40"' },
    { inch: '42"', dn: '1050', label: '42"' },
    { inch: '48"', dn: '1200', label: '1200' },
    { inch: '54"', dn: '1350', label: '1350' },
    { inch: '56"', dn: '1400', label: '1400' },
    { inch: '60"', dn: '1500', label: '1500' }
  ];

  console.log('\n=========================================');
  console.log('1. SIZE MASTER DATA CHECK');
  console.log('=========================================');
  const dbSizeValues = new Set(dbSizes.map(s => String(s.value)));
  const dbSizeLabels = new Set(dbSizes.map(s => String(s.label)));

  expectedSizes.forEach(s => {
    const presentByVal = dbSizeValues.has(s.dn) || dbSizeValues.has(String(parseInt(s.dn, 10)));
    const presentByLabel = dbSizeLabels.has(s.inch) || dbSizeLabels.has(s.inch.replace('"', ''));
    console.log(`Size NPS ${s.inch} (DN ${parseInt(s.dn, 10)}mm / Code ${s.dn}): ${presentByVal || presentByLabel ? '✅ Present' : '❌ Missing'}`);
  });

  // 2. Check Dispatch By Options
  console.log('\n=========================================');
  console.log('2. DISPATCH BY MASTER DATA & FIELDS CHECK');
  console.log('=========================================');
  const dispatchMaster = await MasterData.findOne({ slug: /dispatch/i }).lean();
  console.log('Dispatch MasterData:', dispatchMaster ? dispatchMaster.items.map(i => i.label) : 'None');

  const dispatchField = await FieldDefinition.findOne({ fieldName: /dispatch/i }).lean();
  console.log('Dispatch FieldDefinition Options:', dispatchField ? dispatchField.options : 'None');

  // 3. Check Valve Types
  console.log('\n=========================================');
  console.log('3. VALVE TYPE (Globe Valve) CHECK');
  console.log('=========================================');
  const valveTypeMaster = await MasterData.findOne({ slug: /valve-type/i }).lean();
  console.log('Valve Type MasterData:', valveTypeMaster ? valveTypeMaster.items.map(i => i.label) : 'None');

  const valveTypeField = await FieldDefinition.findOne({ fieldName: 'valve_type' }).lean();
  console.log('Valve Type FieldDefinition Options:', valveTypeField ? valveTypeField.options : 'None');

  // 4. Check Painting DFT Options
  console.log('\n=========================================');
  console.log('4. PAINTING DFT OPTIONS CHECK');
  console.log('=========================================');
  const paintingField = await FieldDefinition.findOne({ fieldName: /painting/i }).lean();
  console.log('Painting FieldDefinition:', paintingField ? { label: paintingField.fieldLabel, options: paintingField.options, placeholder: paintingField.placeholder } : 'None');

  // 5. Check Other Specification & Default PDF Data Mappings
  console.log('\n=========================================');
  console.log('5. OTHER SPECIFICATIONS & DEFAULTS IN PDF DATA FORMATTER');
  console.log('=========================================');
  const dataFormatter = require('../services/quotationPdf/dataFormatter');
  const dummyItem = { dynamicFields: {} };

  console.log('valve_dbb_hydro default:', dataFormatter.extractItemFieldValue(dummyItem, 'valve_dbb_hydro'));
  console.log('valve_back_seat default:', dataFormatter.extractItemFieldValue(dummyItem, 'valve_back_seat'));
  console.log('valve_antistatic_test default:', dataFormatter.extractItemFieldValue(dummyItem, 'valve_antistatic_test'));
  console.log('valve_painting_dft default:', dataFormatter.extractItemFieldValue(dummyItem, 'valve_painting_dft'));
  console.log('valve_packing default:', dataFormatter.extractItemFieldValue(dummyItem, 'valve_packing'));
  console.log('valve_dispatch_by default:', dataFormatter.extractItemFieldValue(dummyItem, 'valve_dispatch_by'));
  console.log('valve_location default:', dataFormatter.extractItemFieldValue(dummyItem, 'valve_location'));
  console.log('valve_other_special default:', dataFormatter.extractItemFieldValue(dummyItem, 'valve_other_special'));
  console.log('annex_a default:', dataFormatter.extractItemFieldValue(dummyItem, 'annex_a'));
  console.log('annex_c default:', dataFormatter.extractItemFieldValue(dummyItem, 'annex_c'));

  await mongoose.disconnect();
}

checkGlobeValveSpecs().catch(err => {
  console.error(err);
  process.exit(1);
});

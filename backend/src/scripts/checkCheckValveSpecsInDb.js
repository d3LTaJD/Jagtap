const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const MasterData = require('../models/MasterData');
const FieldDefinition = require('../models/FieldDefinition');

async function checkCheckValveSpecs() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  // 1. Check Valve Type MasterData & FieldDefinitions for Lift Check & Swing Check
  const valveTypeMaster = await MasterData.findOne({ slug: /valve-type/i }).lean();
  const vtMasterItems = valveTypeMaster ? valveTypeMaster.items.map(i => i.label) : [];

  const valveTypeField = await FieldDefinition.findOne({ fieldName: 'valve_type' }).lean();
  const vtFieldOptions = valveTypeField ? valveTypeField.options : [];

  console.log('\n=========================================');
  console.log('1. VALVE TYPE (Check Valve Variants) CHECK');
  console.log('=========================================');
  console.log('MasterData Valve Types:', vtMasterItems);
  console.log('FieldDefinition valve_type Options:', vtFieldOptions);

  const hasLiftCheck = vtMasterItems.some(i => i.toLowerCase().includes('lift')) || vtFieldOptions.some(o => String(o).toLowerCase().includes('lift'));
  const hasSwingCheck = vtMasterItems.some(i => i.toLowerCase().includes('swing')) || vtFieldOptions.some(o => String(o).toLowerCase().includes('swing'));
  console.log(`Lift Check Valve option: ${hasLiftCheck ? '✅ Present' : '❌ Missing'}`);
  console.log(`Swing Check Valve option: ${hasSwingCheck ? '✅ Present' : '❌ Missing'}`);

  // 2. Check PDF Defaults for Check Valves
  console.log('\n=========================================');
  console.log('2. CHECK VALVE PDF DATA FORMATTER DEFAULTS');
  console.log('=========================================');
  const dataFormatter = require('../services/quotationPdf/dataFormatter');
  const dummyCheckValve = {
    description: 'Check Valve 50MM 150#',
    dynamicFields: { valve_type: 'Check Valve' }
  };

  console.log('valve_dbb_hydro:', dataFormatter.extractItemFieldValue(dummyCheckValve, 'valve_dbb_hydro'));
  console.log('valve_back_seat:', dataFormatter.extractItemFieldValue(dummyCheckValve, 'valve_back_seat'));
  console.log('valve_antistatic_test:', dataFormatter.extractItemFieldValue(dummyCheckValve, 'valve_antistatic_test'));
  console.log('valve_direction:', dataFormatter.extractItemFieldValue(dummyCheckValve, 'valve_direction'));
  console.log('valve_painting_dft:', dataFormatter.extractItemFieldValue(dummyCheckValve, 'valve_painting_dft'));
  console.log('annex_c:', dataFormatter.extractItemFieldValue(dummyCheckValve, 'annex_c'));
  console.log('annex_d:', dataFormatter.extractItemFieldValue(dummyCheckValve, 'annex_d'));
  console.log('annex_g:', dataFormatter.extractItemFieldValue(dummyCheckValve, 'annex_g'));
  console.log('annex_h:', dataFormatter.extractItemFieldValue(dummyCheckValve, 'annex_h'));

  await mongoose.disconnect();
}

checkCheckValveSpecs().catch(err => {
  console.error(err);
  process.exit(1);
});

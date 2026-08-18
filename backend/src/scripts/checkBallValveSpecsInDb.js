const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const dataFormatter = require('../services/quotationPdf/dataFormatter');

async function checkBallValveSpecs() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  console.log('\n=========================================');
  console.log('BALL VALVE PDF DATA FORMATTER DEFAULTS CHECK');
  console.log('=========================================');

  const dummyBallValve = {
    description: 'API 6D Ball Valve 50MM 150#',
    dynamicFields: { valve_type: 'Ball Valve', valve_design_type: '2 P/C LONG' }
  };

  const dummyTmbvValve = {
    description: 'API 6D Trunnion Mounted Ball Valve (TMBV) 100MM 300#',
    dynamicFields: { valve_type: 'Ball Valve', valve_design_type: 'TRUNNION MOUNTED' }
  };

  console.log('--- Floating Ball Valve ---');
  console.log('valve_dbb_hydro:', dataFormatter.extractItemFieldValue(dummyBallValve, 'valve_dbb_hydro'));
  console.log('valve_back_seat:', dataFormatter.extractItemFieldValue(dummyBallValve, 'valve_back_seat'));
  console.log('valve_antistatic_test:', dataFormatter.extractItemFieldValue(dummyBallValve, 'valve_antistatic_test'));
  console.log('valve_painting_dft:', dataFormatter.extractItemFieldValue(dummyBallValve, 'valve_painting_dft'));
  console.log('annex_c:', dataFormatter.extractItemFieldValue(dummyBallValve, 'annex_c'));
  console.log('annex_d:', dataFormatter.extractItemFieldValue(dummyBallValve, 'annex_d'));
  console.log('annex_e:', dataFormatter.extractItemFieldValue(dummyBallValve, 'annex_e'));
  console.log('annex_g:', dataFormatter.extractItemFieldValue(dummyBallValve, 'annex_g'));
  console.log('annex_h:', dataFormatter.extractItemFieldValue(dummyBallValve, 'annex_h'));

  console.log('\n--- Trunnion Mounted Ball Valve (TMBV) ---');
  console.log('valve_dbb_hydro:', dataFormatter.extractItemFieldValue(dummyTmbvValve, 'valve_dbb_hydro'));
  console.log('valve_back_seat:', dataFormatter.extractItemFieldValue(dummyTmbvValve, 'valve_back_seat'));
  console.log('valve_antistatic_test:', dataFormatter.extractItemFieldValue(dummyTmbvValve, 'valve_antistatic_test'));
  console.log('annex_e (TMBV):', dataFormatter.extractItemFieldValue(dummyTmbvValve, 'annex_e'));

  await mongoose.disconnect();
}

checkBallValveSpecs().catch(err => {
  console.error(err);
  process.exit(1);
});

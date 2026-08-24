const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

async function checkMasterData() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const MasterData = require('../models/MasterData');
  const FieldDefinition = require('../models/FieldDefinition');

  const allMD = await MasterData.find({}).lean();
  console.log(`\nTotal MasterData sets in DB: ${allMD.length}`);
  allMD.forEach(md => {
    console.log(`- MasterData: "${md.name}" (slug: ${md.slug}, category: ${md.category}, items count: ${md.data?.length || 0})`);
  });

  const allFD = await FieldDefinition.find({ isDeleted: false }).lean();
  console.log(`\nTotal FieldDefinitions in DB: ${allFD.length}`);
  const valveFDs = allFD.filter(f => f.productCategory === 'Valves' || !f.productCategory);
  console.log(`Valve-related FieldDefinitions: ${valveFDs.length}`);

  await mongoose.disconnect();
}

checkMasterData().catch(console.error);

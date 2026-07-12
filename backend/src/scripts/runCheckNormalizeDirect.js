require('dotenv').config();
const mongoose = require('mongoose');
const FieldDefinition = require('../models/FieldDefinition');
const aiService = require('../services/aiService');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const fields = await FieldDefinition.find({ formContext: 'Enquiry', isDeleted: false, isActive: true });
  
  // Let's check matching for valve_size = "20"
  const f = fields.find(fd => fd.fieldName === 'valve_size');
  console.log('valve_size field options:', f.options);
  
  const extracted = { valve_size: '20' };
  const fieldsMap = { valve_size: f };
  
  // Call internal normalizeExtractedFields via extracting something
  const text = 'Size: 3/4"';
  // We can't call extractDynamicFields directly because it calls OpenAI, but we can copy the normalization code here and run it with the actual FieldDefinition from the database!
  
  const inchToMmMap = {
    '1/2': '15',
    '3/4': '20',
    '1': '25',
    '2': '50',
    '20': '500'
  };

  const val = '20';
  const key = 'valve_size';
  
  let matchVal = val;
  const normalizeStr = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const valNormalized = normalizeStr(val);
  
  const directMatch = f.options.find(opt => normalizeStr(opt) === valNormalized);
  if (directMatch) {
    matchVal = directMatch;
  } else if (key.toLowerCase().includes('size')) {
    const cleanVal = String(val).toLowerCase().replace(/(?:inch|inches|nb|mm|["'\s])+/g, '').trim();
    if (inchToMmMap[cleanVal]) {
      matchVal = inchToMmMap[cleanVal];
    }
  }

  const matchedOpt = f.options.find(opt => {
    const nOpt = normalizeStr(opt);
    const nVal = normalizeStr(matchVal);
    if (nOpt === nVal) return true;
    if (nVal === 'sw' && nOpt.includes('socketweld')) return true;
    if (nVal === 'bw' && nOpt.includes('buttweld')) return true;
    if (nVal === 'fe' && nOpt.includes('flange')) return true;
    if (nVal.includes('flange') && nOpt.includes('flange')) return true;
    if (nVal === 'npt' && nOpt.includes('npt')) return true;
    if (nOpt.includes(nVal) || nVal.includes(nOpt)) return true;
    return false;
  });

  console.log(`Matched Option for "20": ${matchedOpt}`);
  process.exit(0);
}

run().catch(console.error);

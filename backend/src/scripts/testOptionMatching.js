require('dotenv').config();
const mongoose = require('mongoose');
const FieldDefinition = require('../models/FieldDefinition');
const { inchToMmMap } = require('../services/aiService'); // Wait! Is inchToMmMap exported? It's not. Let's copy it here.

const inchToMm = {
  '1/2': '15',
  '3/4': '20',
  '1': '25',
  '1.25': '32',
  '1.1/4': '32',
  '1-1/4': '32',
  '1.5': '40',
  '1.1/2': '40',
  '1-1/2': '40',
  '2': '50',
  '2.5': '65',
  '2.1/2': '65',
  '2-1/2': '65',
  '3': '80',
  '4': '100',
  '5': '125',
  '6': '150',
  '8': '200',
  '10': '250',
  '12': '300',
  '14': '350',
  '16': '400',
  '18': '450',
  '20': '500',
  '24': '600'
};

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const f = await FieldDefinition.findOne({ fieldName: 'valve_size', formContext: 'Enquiry' });
  console.log('Options:', f.options);
  
  const val = '20';
  const key = 'valve_size';
  
  let matchVal = val;
  const normalizeStr = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const valNormalized = normalizeStr(val);
  
  console.log('valNormalized:', valNormalized);
  const directMatch = f.options.find(opt => {
    console.log(`Comparing "${normalizeStr(opt)}" with "${valNormalized}"`);
    return normalizeStr(opt) === valNormalized;
  });
  console.log('directMatch:', directMatch);
  
  if (directMatch) {
    matchVal = directMatch;
  } else if (key.toLowerCase().includes('size')) {
    const cleanVal = String(val).toLowerCase().replace(/(?:inch|inches|nb|mm|["'\s])+/g, '').trim();
    if (inchToMm[cleanVal]) {
      matchVal = inchToMm[cleanVal];
    }
  }
  
  console.log('matchVal:', matchVal);
  process.exit(0);
}

run().catch(console.error);

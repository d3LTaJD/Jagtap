const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../backend/.env') });
if (!process.env.MONGODB_URI) {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
}
const mongoose = require('mongoose');
require('../models/Customer');
require('../models/Enquiry');
require('../models/User');
require('../models/FileMetadata');
const Quotation = require('../models/Quotation');

async function inspectItems1To3() {
  await mongoose.connect(process.env.MONGODB_URI);
  const q = await Quotation.findOne({ quotationId: /QT-2026-08-0009/i }).lean();
  console.log('Quotation:', q.quotationId);
  q.items.forEach((item, i) => {
    console.log(`\n--- ITEM ${i + 1} ---`);
    console.log('description:', item.description);
    console.log('size:', item.size);
    console.log('pressureClass:', item.pressureClass);
    console.log('valveType:', item.valveType);
    console.log('dynamicFields.valve_type:', item.dynamicFields?.valve_type);
    console.log('dynamicFields.valve_size:', item.dynamicFields?.valve_size);
    console.log('dynamicFields.valve_class:', item.dynamicFields?.valve_class);
  });
  await mongoose.disconnect();
}

inspectItems1To3().catch(err => {
  console.error(err);
  process.exit(1);
});

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
const { extractItemFieldValue } = require('../services/quotationPdf/dataFormatter');

async function debugItems() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const q = await Quotation.findOne({ quotationId: /QT-2026-08-0009/i }).lean();
  if (!q) {
    console.error('QT-2026-08-0009 not found');
    process.exit(1);
  }

  console.log(`Quotation ${q.quotationId} has ${q.items?.length} items:\n`);

  q.items.forEach((item, i) => {
    console.log(`--- ITEM ${i + 1} ---`);
    console.log('description:', item.description);
    console.log('productCategory:', item.productCategory);
    console.log('item root properties:', {
      size: item.size,
      pressureClass: item.pressureClass,
      valveType: item.valveType,
      materialGrade: item.materialGrade
    });
    console.log('dynamicFields keys:', Object.keys(item.dynamicFields || {}));
    console.log('extracted valve_type:', extractItemFieldValue(item, 'valve_type'));
    console.log('extracted valve_size:', extractItemFieldValue(item, 'valve_size'));
    console.log('extracted valve_class:', extractItemFieldValue(item, 'valve_class'));
    console.log('\n');
  });

  await mongoose.disconnect();
}

debugItems().catch(err => {
  console.error(err);
  process.exit(1);
});

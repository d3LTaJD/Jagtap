const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
require('../models/Customer');
require('../models/Enquiry');
require('../models/User');
require('../models/FileMetadata');
const Quotation = require('../models/Quotation');
const { extractItemFieldValue } = require('../services/quotationPdf/dataFormatter');

async function diagnose() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Get ALL quotations
  const quotations = await Quotation.find().sort({ createdAt: -1 }).lean();
  console.log(`Total quotations: ${quotations.length}\n`);

  for (const q of quotations) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Quotation: ${q.quotationId} | Items: ${q.items?.length || 0} | Created: ${q.createdAt}`);
    console.log('='.repeat(80));

    (q.items || []).forEach((item, idx) => {
      const vType = extractItemFieldValue(item, 'valve_type', '-');
      const vSize = extractItemFieldValue(item, 'valve_size', '-');
      const vClass = extractItemFieldValue(item, 'valve_class', '-');
      console.log(`  Item ${idx + 1}: type="${vType}" | size="${vSize}" | class="${vClass}" | qty=${item.quantity} | desc="${(item.description || '').substring(0, 80)}..."`);
    });
  }

  await mongoose.disconnect();
}

diagnose().catch(err => { console.error(err); process.exit(1); });

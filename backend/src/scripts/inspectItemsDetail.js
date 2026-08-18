const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
require('../models/Customer');
require('../models/Enquiry');
require('../models/User');
const Quotation = require('../models/Quotation');

async function inspectAllItems() {
  await mongoose.connect(process.env.MONGODB_URI);
  const q = await Quotation.findOne({ quotationId: /QT-2026-08-0009/i })
    .populate('customer')
    .populate('enquiry')
    .lean();

  console.log(`=== Quotation ${q.quotationId} Items Summary ===`);
  q.items.forEach((item, i) => {
    console.log(`\nItem ${i + 1}: ${item.description}`);
    console.log(`  Qty: ${item.quantity}, Unit Price: ${item.unitPrice}, Unit Rate: ${item.unitRate}, Line Total: ${item.lineTotalExclGST}`);
    console.log(`  NDT: ${item.ndtCharges}, SpecTest: ${item.specialTestingCharges}, Spares: ${item.sparesCharges}`);
    
    // Inspect dynamicFields keys with non-null values
    const nonNulls = {};
    for (const [k, v] of Object.entries(item.dynamicFields || {})) {
      if (v !== null && v !== undefined) {
        if (typeof v === 'object' && v.value !== null && v.value !== undefined) {
          nonNulls[k] = v.value;
        } else if (typeof v !== 'object') {
          nonNulls[k] = v;
        }
      }
    }
    console.log('  Non-null dynamicFields values:', nonNulls);
  });

  await mongoose.disconnect();
}

inspectAllItems().catch(err => {
  console.error(err);
  process.exit(1);
});

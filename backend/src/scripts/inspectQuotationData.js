const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../backend/.env') });
if (!process.env.MONGODB_URI) {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
}
const mongoose = require('mongoose');
require('../models/Customer');
require('../models/Enquiry');
require('../models/User');
const Quotation = require('../models/Quotation');

async function inspectQuotation() {
  const uri = process.env.MONGODB_URI;
  console.log('Connecting to MongoDB Atlas at URI:', uri ? uri.split('@')[1] : 'undefined');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB Atlas successfully');

  // Find QT-2026-08-0009 or the latest quotation
  let q = await Quotation.findOne({ quotationId: /QT-2026-08-0009/i })
    .populate('customer')
    .populate('enquiry')
    .lean();

  if (!q) {
    console.log('QT-2026-08-0009 not found exactly, looking for recent quotations:');
    const recent = await Quotation.find().sort({ createdAt: -1 }).limit(10).lean();
    recent.forEach(r => console.log(`- ${r.quotationId} (created: ${r.createdAt})`));
    if (recent.length > 0) {
      q = recent[0];
      console.log(`Using latest quotation: ${q.quotationId}`);
    }
  }

  if (!q) {
    console.log('No quotations found in DB.');
    process.exit(0);
  }

  console.log('\n=========================================');
  console.log('QUOTATION ID:', q.quotationId);
  console.log('CUSTOMER:', q.customer?.companyName, q.customer?.primaryContactName);
  console.log('SENDER COMPANY:', q.senderCompany);
  console.log('CLIENT NAME:', q.clientName);
  console.log('PROJECT NAME:', q.projectName);
  console.log('KIND ATTENTION:', q.kindAttention);
  console.log('ENQUIRY REF:', q.enquiryRefText);
  console.log('CREATED AT:', q.createdAt);
  
  console.log(`\n=========================================`);
  console.log(`TOTAL ITEMS COUNT: ${q.items?.length || 0}`);
  console.log(`=========================================`);
  if (q.items && q.items.length > 0) {
    q.items.forEach((item, idx) => {
      console.log(`\n--- [ITEM ${idx + 1}] ---`);
      console.log('description:', item.description);
      console.log('productCategory:', item.productCategory);
      console.log('quantity:', item.quantity);
      console.log('unitPrice:', item.unitPrice);
      console.log('unitRate:', item.unitRate);
      console.log('lineTotalExclGST:', item.lineTotalExclGST);
      console.log('item root properties:');
      console.log({
        valveType: item.valveType,
        size: item.size,
        pressureClass: item.pressureClass,
        materialGrade: item.materialGrade,
        standardCode: item.standardCode
      });
      console.log('dynamicFields:');
      console.dir(item.dynamicFields, { depth: null });
    });
  }

  console.log('\n=========================================');
  console.log('COMMERCIAL TOTALS & SETTINGS');
  console.log('cert32Percent:', q.cert32Percent);
  console.log('pfPercent:', q.pfPercent);
  console.log('tpiCharges:', q.tpiCharges);
  console.log('commercialTotals:', q.commercialTotals);
  console.log('commercialNotes:', q.commercialNotes);
  console.log('signatoryName:', q.signatoryName);
  console.log('signatoryDesignation:', q.signatoryDesignation);

  await mongoose.disconnect();
}

inspectQuotation().catch(err => {
  console.error(err);
  process.exit(1);
});

require('dotenv').config();
const mongoose = require('mongoose');
require('../models/FieldDefinition');
const Enquiry = require('../models/Enquiry');
const Quotation = require('../models/Quotation');

const verbatimMap = [
  { itemNo: 1, desc: 'BALL API6D HOV F/F A/G TRU BOL 2IN 300#', qty: 35, std: 'API 6D', moc: 'ASTM A216 WCB' },
  { itemNo: 2, desc: 'BALL API6D HOV F/F A/G TRU BOL 10IN 300#', qty: 1, std: 'API 6D', moc: 'ASTM A216 WCB' },
  { itemNo: 3, desc: 'BALL API6D HOV F/F A/G TRU BOL 4IN 300#', qty: 2, std: 'API 6D', moc: 'ASTM A216 WCB' },
  { itemNo: 4, desc: 'BALL API6D,HOV,F/F, A/G,TRU,BOL,3IN 300#', qty: 1, std: 'API 6D', moc: 'ASTM A216 WCB' },
  { itemNo: 5, desc: 'BALL API6D,HOV,F/F, A/G,TRU,BOL,2IN 300#', qty: 2500, std: 'API 6D', moc: 'ASTM A216 WCB' },
  { itemNo: 6, desc: 'VLV,CHK,A216 WCB,A216 WCB,FLG,300,10IN', qty: 1, std: 'BS 1868 / API 6D', moc: 'ASTM A216 WCB' },
  { itemNo: 7, desc: '1" x 800# W/W, A/G, HOV, API 602 GATE VALVE', qty: 2, std: 'API 602', moc: 'ASTM A216 WCB / A105' },
  { itemNo: 8, desc: '18"x ANSI 150# HOV F/F API 600 Gate Valve', qty: 2, std: 'API 600', moc: 'ASTM A216 WCB' },
  { itemNo: 9, desc: '4"x ANSI 150# HOV F/F API 600 Gate Valve', qty: 400, std: 'API 600', moc: 'ASTM A216 WCB' }
];

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const enq = await Enquiry.findOne({ enquiryId: 'ENQ-2026-08-0036' });
  if (enq) {
    console.log('Found Enquiry ENQ-2026-08-0036');
    enq.productDescription = verbatimMap[0].desc;
    await enq.save();
  }

  const quotes = await Quotation.find({ enquiry: enq?._id });
  console.log(`Found ${quotes.length} linked quotation(s)`);
  for (const q of quotes) {
    if (q.items && q.items.length === 9) {
      q.items.forEach((item, idx) => {
        const v = verbatimMap[idx];
        if (v) {
          item.description = v.desc;
          item.quantity = v.qty;
          if (v.std) item.applicableStandard = v.std;
          if (v.moc) item.materialGrade = v.moc;
        }
      });
      q.markModified('items');
      await q.save();
      console.log(`Updated Quotation ${q.quotationId || q._id} with verbatim engineering descriptions!`);
    }
  }

  process.exit(0);
});

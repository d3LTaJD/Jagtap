require('dotenv').config();
const mongoose = require('mongoose');
const aiService = require('../services/aiService');
const { mergeEnquiryProducts } = require('../services/boqParserService');

const body = `Dear Sir,

We kindly request you to provide your best quotation for the following Ball Valves:

 1) 10" Butt Welded Valve,TMBV ,300# =1 Nos

 2) 4" Flange Ended Valve ,300# Nos =6 Nos

 3) 2" Flange Ended Valve  300# =2 Nos

 4) 2" Flange Ended Valve ,600# = 02 Nos

 5) 1/2" Valve 800# Ball Valve,SW = 02 Nos

 6) 2" Butt Welded Valve ,300# = 3 Nos

 7) 2"Globe Valve,FE 300# =1 Nos
P.D.Patel
Petro Valves Pvt.Ltd.`;

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const result = await aiService.extractEnquiries(body, [], { from: 'sender@example.com', subject: 'Test' });
  console.log('--- RAW AI EXTRACTED ---');
  console.log(JSON.stringify(result.enquiries.map(e => ({
    cat: e.productCategory,
    desc: e.productDescription,
    qty: e.quantity
  })), null, 2));

  const merged = mergeEnquiryProducts(result.enquiries.map(item => ({
    productCategory: item.productCategory || 'Custom',
    productDescription: item.productDescription || '',
    quantity: item.quantity || 1,
    unit: item.unit || 'NOS',
    standardCode: item.standardCode || 'Not specified',
    specialRequirements: item.specialRequirements || '',
    priority: item.priority || 'Medium',
    confidence: item.confidence || 90,
    linkedAttachmentNames: item.linkedAttachmentNames || []
  })));

  console.log('--- AFTER MERGING ---');
  console.log(JSON.stringify(merged.map(e => ({
    cat: e.productCategory,
    desc: e.productDescription,
    qty: e.quantity
  })), null, 2));

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

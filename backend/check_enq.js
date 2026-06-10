const mongoose = require('mongoose');
const MONGO_URI = 'mongodb+srv://jeetdodia12_db_user:JD86048604%40%40@jagtap.p3fbvac.mongodb.net/petro-valve?appName=petro-valve';
mongoose.connect(MONGO_URI).then(async () => {
  const Enquiry = require('./src/models/Enquiry');
  const enqs = await Enquiry.find().sort({ createdAt: -1 }).limit(10);
  console.log('Total enquiries:', enqs.length);
  for (const e of enqs) {
    console.log('---');
    console.log('ID:', e.enquiryId, '| Status:', e.status);
    console.log('Product:', e.productDescription ? e.productDescription.substring(0,60) : 'NONE');
    console.log('dynamicFields:', JSON.stringify(e.dynamicFields));
  }
  process.exit(0);
}).catch(function(e) { console.error(e.message); process.exit(1); });

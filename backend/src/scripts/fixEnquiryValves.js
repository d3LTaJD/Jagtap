require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const enq = await db.collection('enquiries').findOne({ enquiryId: 'ENQ-2026-07-0008' });
  if (enq) {
    const updated = enq.products.map(p => {
      if (p.dynamicFields && p.dynamicFields.valve_type && p.dynamicFields.valve_type.value === 'Flange Ended Valve') {
        p.dynamicFields.valve_type.value = 'Ball Valve';
      }
      return p;
    });
    await db.collection('enquiries').updateOne(
      { _id: enq._id },
      { $set: { products: updated } }
    );
    console.log('Successfully fixed ENQ-2026-07-0008 products in DB.');
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB Connected.');

  const db = mongoose.connection.db;

  // 1. Update Enquiries
  const enquiriesRes = await db.collection('enquiries').updateMany(
    { productCategory: 'Piping' },
    { $set: { productCategory: 'Piping / Valves' } }
  );
  console.log(`Updated enquiries: matched=${enquiriesRes.matchedCount}, modified=${enquiriesRes.modifiedCount}`);

  // 2. Update Enquiry Line Items (products)
  // Find all enquiries and update their product categories inside the products array
  const enquiries = await db.collection('enquiries').find({ 'products.category': 'Piping' }).toArray();
  console.log(`Found ${enquiries.length} enquiries with products of category Piping.`);
  for (const enq of enquiries) {
    const updatedProducts = enq.products.map(p => {
      if (p.category === 'Piping') p.category = 'Piping / Valves';
      return p;
    });
    await db.collection('enquiries').updateOne(
      { _id: enq._id },
      { $set: { products: updatedProducts } }
    );
  }
  console.log('Updated enquiry products.');

  // 3. Update Field Definitions
  const fieldsRes = await db.collection('fielddefinitions').updateMany(
    { productCategory: 'Piping' },
    { $set: { productCategory: 'Piping / Valves' } }
  );
  console.log(`Updated fielddefinitions category: matched=${fieldsRes.matchedCount}, modified=${fieldsRes.modifiedCount}`);

  // Also update conditional logic requiredValue in field definitions
  const condRes = await db.collection('fielddefinitions').updateMany(
    { 'conditionalLogic.requiredValue': 'Piping' },
    { $set: { 'conditionalLogic.requiredValue': 'Piping / Valves' } }
  );
  console.log(`Updated fielddefinitions conditionalLogic requiredValue: matched=${condRes.matchedCount}, modified=${condRes.modifiedCount}`);

  console.log('Migration completed successfully.');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

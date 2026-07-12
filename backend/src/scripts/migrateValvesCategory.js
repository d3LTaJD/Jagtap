require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  // 1. Migrate enquiries productCategory
  const enquiriesResult = await db.collection('enquiries').updateMany(
    { productCategory: 'Piping / Valves' },
    { $set: { productCategory: 'Valves' } }
  );
  console.log(`Migrated ${enquiriesResult.modifiedCount} enquiries productCategory to 'Valves'.`);

  // 2. Migrate products category nested arrays inside enquiries
  const enquiries = await db.collection('enquiries').find({ 'products.category': 'Piping / Valves' }).toArray();
  let productsCount = 0;
  for (const enq of enquiries) {
    const updatedProducts = enq.products.map(p => {
      if (p.category === 'Piping / Valves') {
        p.category = 'Valves';
        productsCount++;
      }
      return p;
    });
    await db.collection('enquiries').updateOne(
      { _id: enq._id },
      { $set: { products: updatedProducts } }
    );
  }
  console.log(`Migrated ${productsCount} nested enquiry products to 'Valves'.`);

  // 3. Migrate fielddefinitions productCategory
  const fieldsResult = await db.collection('fielddefinitions').updateMany(
    { productCategory: 'Piping / Valves' },
    { $set: { productCategory: 'Valves' } }
  );
  console.log(`Migrated ${fieldsResult.modifiedCount} field definitions productCategory to 'Valves'.`);

  // 4. Migrate fielddefinitions conditionalLogic
  const condResult = await db.collection('fielddefinitions').updateMany(
    { 'conditionalLogic.requiredValue': 'Piping / Valves' },
    { $set: { 'conditionalLogic.requiredValue': 'Valves' } }
  );
  console.log(`Migrated ${condResult.modifiedCount} field definitions conditional logic to 'Valves'.`);

  // 5. Migrate quotations productCategory in items nested arrays
  const quotations = await db.collection('quotations').find({ 'items.productCategory': 'Piping / Valves' }).toArray();
  let quoteItemsCount = 0;
  for (const q of quotations) {
    const updatedItems = q.items.map(item => {
      if (item.productCategory === 'Piping / Valves') {
        item.productCategory = 'Valves';
        quoteItemsCount++;
      }
      return item;
    });
    await db.collection('quotations').updateOne(
      { _id: q._id },
      { $set: { items: updatedItems } }
    );
  }
  console.log(`Migrated ${quoteItemsCount} nested quotation items to 'Valves'.`);

  console.log('Migration completed successfully.');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB Connected.');

  const db = mongoose.connection.db;
  const collection = db.collection('fielddefinitions');

  const fields = await collection.find({ isDeleted: false, isActive: true }).toArray();

  const groups = {};
  for (const f of fields) {
    const key = `${f.fieldName || ''}|${f.productCategory || ''}|${f.formContext || ''}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
  }

  for (const [key, items] of Object.entries(groups)) {
    if (items.length > 1) {
      console.log(`\nDuplicate found for key: ${key}`);
      // Find the one with the most options or newer
      items.sort((a, b) => {
        const aLen = (a.options || []).length;
        const bLen = (b.options || []).length;
        return bLen - aLen; // Descending by options count
      });

      const keep = items[0];
      const remove = items.slice(1);

      console.log(`KEEP: ID=${keep._id}, Label=${keep.fieldLabel}, Options Count=${(keep.options || []).length}`);
      for (const rem of remove) {
        console.log(`DELETE: ID=${rem._id}, Label=${rem.fieldLabel}, Options Count=${(rem.options || []).length}`);
        await collection.updateOne({ _id: rem._id }, { $set: { isDeleted: true } });
      }
    }
  }

  console.log('\nCleanup done.');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

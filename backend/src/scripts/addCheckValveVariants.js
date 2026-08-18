const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const MasterData = require('../models/MasterData');
const FieldDefinition = require('../models/FieldDefinition');

async function updateCheckValveDb() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas');

  const newVariants = ['Lift Check Valve', 'Swing Check Valve'];

  // 1. Update MasterData for valve-type
  const vtMaster = await MasterData.findOne({ slug: 'valve-type' });
  if (vtMaster) {
    let addedCount = 0;
    newVariants.forEach((v, idx) => {
      const exists = vtMaster.items.some(it => String(it.label).toLowerCase() === v.toLowerCase());
      if (!exists) {
        vtMaster.items.push({
          label: v,
          value: v,
          description: v,
          sortOrder: vtMaster.items.length + 1,
          isActive: true
        });
        addedCount++;
      }
    });
    await vtMaster.save();
    console.log(`✅ Added ${addedCount} Check Valve variants to MasterData (slug: valve-type). Total items: ${vtMaster.items.length}`);
  } else {
    console.log('⚠️ MasterData slug "valve-type" not found');
  }

  // 2. Update FieldDefinition for valve_type
  const vtFields = await FieldDefinition.find({
    fieldName: { $in: ['valve_type', 'valveType', 'productType'] }
  });

  for (const f of vtFields) {
    if (Array.isArray(f.options)) {
      let fAdded = 0;
      newVariants.forEach(v => {
        const exists = f.options.some(opt => {
          if (typeof opt === 'string') return opt.toLowerCase() === v.toLowerCase();
          return (opt.label || opt.value || '').toLowerCase() === v.toLowerCase();
        });
        if (!exists) {
          f.options.push(v);
          fAdded++;
        }
      });
      await f.save();
      console.log(`✅ Updated FieldDefinition [${f.fieldName}]: added ${fAdded} options.`);
    }
  }

  await mongoose.disconnect();
  console.log('Database update complete.');
}

updateCheckValveDb().catch(err => {
  console.error(err);
  process.exit(1);
});

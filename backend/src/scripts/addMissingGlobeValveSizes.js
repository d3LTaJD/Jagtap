const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const MasterData = require('../models/MasterData');
const FieldDefinition = require('../models/FieldDefinition');

async function addMissingSizes() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas');

  const missingSizes = [
    { label: '22"', value: '550', description: '22 Inch (550 mm)' },
    { label: '34"', value: '850', description: '34 Inch (850 mm)' },
    { label: '38"', value: '950', description: '38 Inch (950 mm)' },
    { label: '48"', value: '1200', description: '48 Inch (1200 mm)' },
    { label: '54"', value: '1350', description: '54 Inch (1350 mm)' },
    { label: '56"', value: '1400', description: '56 Inch (1400 mm)' },
    { label: '60"', value: '1500', description: '60 Inch (1500 mm)' }
  ];

  // 1. Update MasterData
  const sizeMaster = await MasterData.findOne({ slug: 'size' });
  if (sizeMaster) {
    let addedCount = 0;
    missingSizes.forEach(s => {
      const exists = sizeMaster.items.some(it => String(it.label) === s.label || String(it.value) === s.value);
      if (!exists) {
        sizeMaster.items.push({
          label: s.label,
          value: s.value,
          description: s.description,
          sortOrder: sizeMaster.items.length + 1,
          isActive: true
        });
        addedCount++;
      }
    });
    await sizeMaster.save();
    console.log(`✅ Added ${addedCount} missing sizes to MasterData (slug: size). Total sizes now: ${sizeMaster.items.length}`);
  } else {
    console.log('⚠️ MasterData slug "size" not found.');
  }

  // 2. Update FieldDefinition options for size fields if present
  const sizeFields = await FieldDefinition.find({
    fieldName: { $in: ['valve_size', 'size', 'size_mm', 'valveSize'] }
  });

  for (const f of sizeFields) {
    if (Array.isArray(f.options)) {
      let fAdded = 0;
      missingSizes.forEach(s => {
        const exists = f.options.some(opt => {
          if (typeof opt === 'string') return opt === s.label || opt === `${s.label} (${s.value}mm)`;
          return opt.label === s.label || opt.value === s.value;
        });
        if (!exists) {
          f.options.push({ label: s.label, value: s.value });
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

addMissingSizes().catch(err => {
  console.error(err);
  process.exit(1);
});

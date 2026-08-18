const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const FieldDefinition = require('../models/FieldDefinition');
const MasterData = require('../models/MasterData');

async function checkMocInDb() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas');

  console.log('\n=========================================');
  console.log('FIELD DEFINITIONS IN DB (MOC RELATED)');
  console.log('=========================================');

  const fields = await FieldDefinition.find({
    $or: [
      { fieldName: /moc/i },
      { fieldLabel: /moc/i },
      { fieldLabel: /material/i },
      { fieldLabel: /body/i },
      { fieldLabel: /ball/i },
      { fieldLabel: /stem/i },
      { fieldLabel: /seat/i },
      { fieldLabel: /stud/i }
    ]
  }).lean();

  fields.forEach(f => {
    console.log(`\n[Field: ${f.fieldName}] Context: ${f.formContext} | Category: ${f.productCategory} | Label: "${f.fieldLabel}"`);
    console.log(`Type: ${f.fieldType} | IsActive: ${f.isActive}`);
    console.log(`Options Count: ${f.options?.length || 0}`);
    if (f.options && f.options.length > 0) {
      console.log('Sample Options (first 20):');
      f.options.slice(0, 20).forEach(opt => {
        if (typeof opt === 'object') {
          console.log(`  - label: "${opt.label || opt.name || opt.value}", value: "${opt.value || opt.id}"`);
        } else {
          console.log(`  - "${opt}"`);
        }
      });
    }
  });

  console.log('\n=========================================');
  console.log('MASTER DATA CATEGORIES IN DB');
  console.log('=========================================');

  const masters = await MasterData.find().lean();
  masters.forEach(m => {
    console.log(`\nMasterData: "${m.name}" (slug: ${m.slug}) | Items Count: ${m.items?.length || 0}`);
    if (m.items && m.items.length > 0) {
      console.log('Items:');
      m.items.forEach(it => console.log(`  - label: "${it.label}", value: "${it.value}"`));
    }
  });

  await mongoose.disconnect();
}

checkMocInDb().catch(err => {
  console.error(err);
  process.exit(1);
});

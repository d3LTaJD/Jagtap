const mongoose = require('mongoose');
const MONGO_URI = 'mongodb+srv://jeetdodia12_db_user:JD86048604%40%40@jagtap.p3fbvac.mongodb.net/petro-valve?appName=petro-valve';
mongoose.connect(MONGO_URI).then(async () => {
  const FieldDefinition = require('./src/models/FieldDefinition');
  const fields = await FieldDefinition.find({ formContext: 'Enquiry', isDeleted: false, isActive: true });
  console.log('Total active fields:', fields.length);
  for (const f of fields) {
    console.log(`Field: ${f.fieldName} | Label: ${f.fieldLabel} | Required: ${f.isRequired} | Category: ${f.productCategory}`);
  }
  process.exit(0);
}).catch(function(e) { console.error(e.message); process.exit(1); });

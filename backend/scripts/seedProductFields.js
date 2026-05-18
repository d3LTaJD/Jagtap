const mongoose = require('mongoose');
const FieldDefinition = require('../src/models/FieldDefinition');
require('dotenv').config();

const fields = [
  // --- PRESSURE VESSEL FIELDS ---
  {
    formContext: 'Enquiry',
    fieldName: 'asmeSection',
    fieldLabel: 'ASME Section',
    fieldType: 'Dropdown (Single)',
    groupLabel: 'Pressure Vessel Specs',
    options: ['VIII Div 1', 'VIII Div 2', 'N/A'],
    displayOrder: 10
  },
  {
    formContext: 'Enquiry',
    fieldName: 'designPressure',
    fieldLabel: 'Design Pressure',
    fieldType: 'Number',
    groupLabel: 'Pressure Vessel Specs',
    validationRules: { unitLabel: 'MPa' },
    displayOrder: 11
  },
  {
    formContext: 'Enquiry',
    fieldName: 'designTemperature',
    fieldLabel: 'Design Temp',
    fieldType: 'Number',
    groupLabel: 'Pressure Vessel Specs',
    validationRules: { unitLabel: '°C' },
    displayOrder: 12
  },
  {
    formContext: 'Enquiry',
    fieldName: 'shellMaterial',
    fieldLabel: 'Shell Material',
    fieldType: 'Dropdown (Single)',
    groupLabel: 'Pressure Vessel Specs',
    options: ['SA516 Gr.70', 'SS304', 'SS316L', 'IS2062'],
    displayOrder: 13
  },
  {
    formContext: 'Enquiry',
    fieldName: 'pwhtRequired',
    fieldLabel: 'PWHT Required',
    fieldType: 'Checkbox (Boolean)',
    groupLabel: 'Pressure Vessel Specs',
    displayOrder: 14
  },
  {
    formContext: 'Enquiry',
    fieldName: 'radiographyPercent',
    fieldLabel: 'Radiography %',
    fieldType: 'Number',
    groupLabel: 'Pressure Vessel Specs',
    validationRules: { min: 0, max: 100, unitLabel: '%' },
    displayOrder: 15
  },

  // --- HEAT EXCHANGER FIELDS ---
  {
    formContext: 'Enquiry',
    fieldName: 'temaType',
    fieldLabel: 'TEMA Type',
    fieldType: 'Text (Short)',
    groupLabel: 'Heat Exchanger Specs',
    placeholder: 'e.g. BES, AEL',
    displayOrder: 20
  },
  {
    formContext: 'Enquiry',
    fieldName: 'tubeLength',
    fieldLabel: 'Tube Length',
    fieldType: 'Number',
    groupLabel: 'Heat Exchanger Specs',
    validationRules: { unitLabel: 'mm' },
    displayOrder: 21
  },
  {
    formContext: 'Enquiry',
    fieldName: 'surfaceArea',
    fieldLabel: 'Surface Area',
    fieldType: 'Number',
    groupLabel: 'Heat Exchanger Specs',
    validationRules: { unitLabel: 'm²' },
    displayOrder: 22
  },

  // --- STORAGE TANK FIELDS ---
  {
    formContext: 'Enquiry',
    fieldName: 'tankCapacity',
    fieldLabel: 'Capacity',
    fieldType: 'Number',
    groupLabel: 'Storage Tank Specs',
    validationRules: { unitLabel: 'm³' },
    displayOrder: 30
  },
  {
    formContext: 'Enquiry',
    fieldName: 'tankType',
    fieldLabel: 'Tank Type',
    fieldType: 'Dropdown (Single)',
    groupLabel: 'Storage Tank Specs',
    options: ['Fixed Roof', 'Floating Roof', 'Cone Bottom', 'Flat Bottom'],
    displayOrder: 31
  },

  // --- QAP SPECIAL FIELDS ---
  {
    formContext: 'QAP',
    fieldName: 'inspectorSignature',
    fieldLabel: 'Inspector Signature',
    fieldType: 'Signature',
    groupLabel: 'Approvals',
    displayOrder: 100
  },
  {
    formContext: 'QAP',
    fieldName: 'inspectionLocation',
    fieldLabel: 'Inspection GPS Location',
    fieldType: 'GPS Location',
    groupLabel: 'Inspection Log',
    displayOrder: 101
  },
  // --- MASTER DATA DRIVEN FIELDS (Product Context) ---
  { formContext: 'Product', fieldName: 'valveType', fieldLabel: 'VALVE TYPE', fieldType: 'Dropdown (Single)', groupLabel: 'Master Specs', displayOrder: 1 },
  { formContext: 'Product', fieldName: 'designType', fieldLabel: 'DESIGN TYPE', fieldType: 'Dropdown (Single)', groupLabel: 'Master Specs', displayOrder: 2 },
  { formContext: 'Product', fieldName: 'bore', fieldLabel: 'BORE', fieldType: 'Dropdown (Single)', groupLabel: 'Master Specs', displayOrder: 3 },
  { formContext: 'Product', fieldName: 'endConnection', fieldLabel: 'END CONNECTION', fieldType: 'Dropdown (Single)', groupLabel: 'Master Specs', displayOrder: 4 },
  { formContext: 'Product', fieldName: 'class', fieldLabel: 'CLASS', fieldType: 'Dropdown (Single)', groupLabel: 'Master Specs', displayOrder: 5 },
  { formContext: 'Product', fieldName: 'operating', fieldLabel: 'OPERATING', fieldType: 'Dropdown (Single)', groupLabel: 'Master Specs', displayOrder: 6 },
  { formContext: 'Product', fieldName: 'ballType', fieldLabel: 'BALL TYPE', fieldType: 'Dropdown (Single)', groupLabel: 'Master Specs', displayOrder: 7 },
  { formContext: 'Product', fieldName: 'size', fieldLabel: 'SIZE', fieldType: 'Dropdown (Single)', groupLabel: 'Master Specs', displayOrder: 8 },
  { formContext: 'Product', fieldName: 'operation', fieldLabel: 'OPERATION', fieldType: 'Dropdown (Single)', groupLabel: 'Master Specs', displayOrder: 9 },
  { formContext: 'Product', fieldName: 'partsBom', fieldLabel: 'PARTS / BOM', fieldType: 'Dropdown (Single)', groupLabel: 'Master Specs', displayOrder: 10 },
  { formContext: 'Product', fieldName: 'moc', fieldLabel: 'MOC (Material of Construction)', fieldType: 'Dropdown (Single)', groupLabel: 'Master Specs', displayOrder: 11 },
];

const MasterData = require('../src/models/MasterData');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');

    for (const field of fields) {
      // 1. Create/Update the FieldDefinition
      const savedField = await FieldDefinition.findOneAndUpdate(
        { formContext: field.formContext, fieldName: field.fieldName },
        field,
        { upsert: true, new: true }
      );
      console.log(`✓ Seeded Field: ${field.fieldLabel} (${field.formContext})`);

      // 2. If it's one of our Master Data driven fields, Link it and Sync Options
      if (field.groupLabel === 'Master Specs') {
        const masterCat = await MasterData.findOne({ name: field.fieldLabel });
        if (masterCat) {
          // Sync options: "Code - Name" format
          const activeOptions = masterCat.items.filter(i => i.isActive).map(i => `${i.value} - ${i.label}`);
          await FieldDefinition.findByIdAndUpdate(savedField._id, { $set: { options: activeOptions } });
          
          // Link master category to field
          if (!masterCat.linkedFields.includes(savedField._id)) {
            masterCat.linkedFields.push(savedField._id);
            await masterCat.save();
          }
          console.log(`  ↳ Linked to Master Data: ${field.fieldLabel} with ${activeOptions.length} options.`);
        }
      }
    }

    console.log('Seeding complete.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
};

seed();

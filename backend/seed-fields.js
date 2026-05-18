require('dotenv').config();
const mongoose = require('mongoose');
const FieldDefinition = require('./src/models/FieldDefinition');

const seedData = [
  {
    formContext: 'Enquiry',
    productCategory: 'Pressure Vessel',
    fieldName: 'asmeSection',
    fieldLabel: 'ASME Section',
    groupLabel: 'Technical Requirements',
    fieldType: 'Dropdown (Single)',
    options: ['Section I', 'Section VIII Div 1', 'Section VIII Div 2', 'Section III', 'B31.3', 'B31.1', 'Other'],
    conditionalLogic: { dependsOnField: 'standardCode', requiredValue: 'ASME' },
    isRequired: true,
    displayOrder: 10
  },
  {
    formContext: 'Enquiry',
    productCategory: 'Pressure Vessel',
    fieldName: 'designCodeEdition',
    fieldLabel: 'Design Code Edition',
    groupLabel: 'Technical Requirements',
    fieldType: 'Text (Short)',
    placeholder: 'e.g. 2019, 2021',
    conditionalLogic: { dependsOnField: 'standardCode', requiredValue: 'ASME' },
    isRequired: true,
    displayOrder: 20
  },
  {
    formContext: 'Enquiry',
    productCategory: 'Pressure Vessel',
    fieldName: 'designPressure',
    fieldLabel: 'Design Pressure',
    groupLabel: 'Technical Requirements',
    fieldType: 'Number',
    validationRules: { unitLabel: 'MPa' },
    conditionalLogic: { dependsOnField: 'standardCode', requiredValue: 'ASME' },
    isRequired: true,
    displayOrder: 30
  },
  {
    formContext: 'Enquiry',
    productCategory: 'Pressure Vessel',
    fieldName: 'designTemperature',
    fieldLabel: 'Design Temperature',
    groupLabel: 'Technical Requirements',
    fieldType: 'Number',
    validationRules: { unitLabel: '°C', min: -200, max: 1000 },
    conditionalLogic: { dependsOnField: 'standardCode', requiredValue: 'ASME' },
    isRequired: true,
    displayOrder: 40
  },
  {
    formContext: 'Enquiry',
    productCategory: 'Pressure Vessel',
    fieldName: 'operatingPressure',
    fieldLabel: 'Operating Pressure',
    groupLabel: 'Technical Requirements',
    fieldType: 'Number',
    validationRules: { unitLabel: 'MPa' },
    conditionalLogic: { dependsOnField: 'standardCode', requiredValue: 'ASME' },
    isRequired: false,
    displayOrder: 50
  },
  {
    formContext: 'Enquiry',
    productCategory: 'Pressure Vessel',
    fieldName: 'operatingTemperature',
    fieldLabel: 'Operating Temperature',
    groupLabel: 'Technical Requirements',
    fieldType: 'Number',
    validationRules: { unitLabel: '°C' },
    conditionalLogic: { dependsOnField: 'standardCode', requiredValue: 'ASME' },
    isRequired: false,
    displayOrder: 60
  },
  {
    formContext: 'Enquiry',
    productCategory: 'Pressure Vessel',
    fieldName: 'radiographyRequired',
    fieldLabel: 'Radiography Required',
    groupLabel: 'Technical Requirements',
    fieldType: 'Dropdown (Single)',
    options: ['Full RT', 'Spot RT', 'None', 'Per Code'],
    conditionalLogic: { dependsOnField: 'standardCode', requiredValue: 'ASME' },
    isRequired: true,
    displayOrder: 70
  },
  {
    formContext: 'Enquiry',
    productCategory: 'Pressure Vessel',
    fieldName: 'pwhtRequired',
    fieldLabel: 'PWHT Required',
    groupLabel: 'Technical Requirements',
    fieldType: 'Checkbox (Boolean)',
    conditionalLogic: { dependsOnField: 'standardCode', requiredValue: 'ASME' },
    isRequired: false,
    displayOrder: 80
  },
  {
    formContext: 'Enquiry',
    productCategory: 'Pressure Vessel',
    fieldName: 'materialTestCertificate',
    fieldLabel: 'Material Test Certificate',
    groupLabel: 'Technical Requirements',
    fieldType: 'Dropdown (Single)',
    options: ['Required', 'Not Required', 'To be confirmed'],
    conditionalLogic: { dependsOnField: 'standardCode', requiredValue: 'ASME' },
    isRequired: false,
    displayOrder: 90
  },
  {
    formContext: 'Enquiry',
    productCategory: 'Pressure Vessel',
    fieldName: 'hardnessTestRequired',
    fieldLabel: 'Hardness Test Required',
    groupLabel: 'Technical Requirements',
    fieldType: 'Checkbox (Boolean)',
    conditionalLogic: { dependsOnField: 'standardCode', requiredValue: 'ASME' },
    isRequired: false,
    displayOrder: 100
  },
  {
    formContext: 'Enquiry',
    productCategory: 'Pressure Vessel',
    fieldName: 'impactTestRequired',
    fieldLabel: 'Impact Test Required',
    groupLabel: 'Technical Requirements',
    fieldType: 'Checkbox (Boolean)',
    conditionalLogic: { dependsOnField: 'standardCode', requiredValue: 'ASME' },
    isRequired: false,
    displayOrder: 110
  },
  {
    formContext: 'Enquiry',
    productCategory: 'Pressure Vessel',
    fieldName: 'hydrostaticTestPressure',
    fieldLabel: 'Hydrostatic Test Pressure',
    groupLabel: 'Technical Requirements',
    fieldType: 'Number',
    validationRules: { unitLabel: 'MPa' },
    conditionalLogic: { dependsOnField: 'standardCode', requiredValue: 'ASME' },
    isRequired: false,
    displayOrder: 120
  },
  {
    formContext: 'Enquiry',
    productCategory: 'Pressure Vessel',
    fieldName: 'pmiRequired',
    fieldLabel: 'PMI Required',
    groupLabel: 'Technical Requirements',
    fieldType: 'Checkbox (Boolean)',
    conditionalLogic: { dependsOnField: 'standardCode', requiredValue: 'ASME' },
    isRequired: false,
    displayOrder: 130
  },
  {
    formContext: 'Enquiry',
    productCategory: 'Pressure Vessel',
    fieldName: 'applicableAddenda',
    fieldLabel: 'Applicable Addenda / Code Cases',
    groupLabel: 'Technical Requirements',
    fieldType: 'Text (Short)',
    validationRules: { maxLength: 100 },
    conditionalLogic: { dependsOnField: 'standardCode', requiredValue: 'ASME' },
    isRequired: false,
    displayOrder: 140
  }
];

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/petro-valve-workflow')
  .then(async () => {
    console.log('Connected to MongoDB. Identifying ASME section dynamic fields...');
    for (const data of seedData) {
      // Find and update or insert to prevent dupes
      await FieldDefinition.findOneAndUpdate(
        { formContext: data.formContext, fieldName: data.fieldName },
        { $set: data },
        { upsert: true, new: true }
      );
    }
    console.log('✅ Succesfully seeded ASME Technical Requirements for Pressure Vessels.');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

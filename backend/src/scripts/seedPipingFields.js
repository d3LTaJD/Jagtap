/**
 * Seed Script — Piping & Ball Valve Specifications Dynamic Fields
 * -------------------------------------------------------------
 * Run with: node src/scripts/seedPipingFields.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const FieldDefinition = require('../models/FieldDefinition');

const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGODB_URI);
  console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
};

const makeField = (context, label, fieldName, fieldType, options = [], extras = {}) => ({
  formContext: context,
  productCategory: 'Valves',
  fieldName,
  fieldLabel: label,
  fieldType,
  options,
  isActive: true,
  isDeleted: false,
  visibleToRoles: [],
  editableByRoles: [],
  conditionalLogic: {
    dependsOnField: 'productCategory',
    requiredValue: 'Valves'
  },
  ...extras
});

// Define fields for Ball Valves specifications
const getPipingFieldsForContext = (context) => {
  let order = 100;
  return [
    // General Valve Details
    makeField(context, 'Valve Type', 'valve_type', 'Dropdown (Single)', ['Ball Valve', 'Check Valve', 'Globe Valve'], { groupLabel: 'Valve Specifications', displayOrder: order++, isRequired: true }),
    makeField(context, 'Valve Size (DN)', 'valve_size', 'Dropdown (Single)', [
      '15', '20', '25', '32', '40', '50', '65', '80', '100', '150', '200', '250', '300',
      '350', '400', '450', '500', '550', '600', '650', '700', '750', '800', '850', '900',
      '950', '1000', '1050', '1200', '1350', '1400', '1500'
    ], { groupLabel: 'Valve Specifications', displayOrder: order++, isRequired: true, validationRules: { unitLabel: 'mm' } }),
    makeField(context, 'Pressure Class', 'valve_class', 'Dropdown (Single)', ['150#', '300#', '600#', '800#', '900#', '1500#', '2500#'], { groupLabel: 'Valve Specifications', displayOrder: order++, isRequired: true }),
    makeField(context, 'API 6D Monogram Required', 'valve_api6d_monogram', 'Dropdown (Single)', ['NO', 'Yes'], { groupLabel: 'Valve Specifications', displayOrder: order++ }),
    makeField(context, 'QSL Level', 'valve_qsl_level', 'Dropdown (Single)', ['NO', 'QSL 2', 'QSL 3', 'QSL 3G', 'QSL 4', 'QSL 4G'], { groupLabel: 'Valve Specifications', displayOrder: order++ }),
    
    // Design parameters
    makeField(context, 'Design Type', 'valve_design_type', 'Dropdown (Single)', ['2 Piece', '3 Piece'], { groupLabel: 'Valve Specifications', displayOrder: order++ }),
    makeField(context, 'Bore', 'valve_bore', 'Dropdown (Single)', ['Full Bore', 'Reduced Bore'], { groupLabel: 'Valve Specifications', displayOrder: order++ }),
    makeField(context, 'End Connection', 'valve_end_connection', 'Dropdown (Single)', ['Flange End', 'Butt Weld', 'Socket Weld', 'Socket Weld with Pups', 'NPT', 'Screwed', 'Flanged RF', 'Other'], { groupLabel: 'Valve Specifications', displayOrder: order++ }),
    makeField(context, 'Operating Type', 'valve_operating', 'Dropdown (Single)', ['Handle', 'Gear Box', 'Actuator', 'Hand Wheel'], { groupLabel: 'Valve Specifications', displayOrder: order++ }),
    makeField(context, 'Ball Type', 'valve_ball_type', 'Dropdown (Single)', ['Floating', 'Trunnion Mounted (TMBV)'], { groupLabel: 'Valve Specifications', displayOrder: order++ }),
    makeField(context, 'Direction', 'valve_direction', 'Dropdown (Single)', ['2 Way', '3 Way', '4 Way', '5 Way'], { groupLabel: 'Valve Specifications', displayOrder: order++ }),
    makeField(context, 'Service', 'valve_service', 'Dropdown (Single)', ['Liquid/Gas', 'Other'], { groupLabel: 'Valve Specifications', displayOrder: order++ }),
    makeField(context, 'Seat Type', 'valve_seat_type', 'Dropdown (Single)', ['Floating - Soft Seat', 'TMBV - Primary Soft Secondary Metal'], { groupLabel: 'Valve Specifications', displayOrder: order++ }),
    makeField(context, 'Valve Design Standard', 'valve_design_std', 'Dropdown (Single)', ['ISO 17292', 'API 6D 25TH ED', 'BS 1868', 'ISO 15761', 'BS 1873'], { groupLabel: 'Valve Specifications', displayOrder: order++ }),
    makeField(context, 'Valve Testing Standard', 'valve_testing_std', 'Dropdown (Single)', ['API 598', 'API 6D 25TH ED'], { groupLabel: 'Valve Specifications', displayOrder: order++ }),
    
    // Temperature and Connections
    makeField(context, 'Min Design Temperature', 'valve_min_design_temp', 'Dropdown (Single)', ['0° C', '-29° C', '-45° C'], { groupLabel: 'Temperature & Accessory Connections', displayOrder: order++ }),
    makeField(context, 'Max Design Temperature', 'valve_max_design_temp', 'Dropdown (Single)', ['65° C', '121° C'], { groupLabel: 'Temperature & Accessory Connections', displayOrder: order++ }),
    makeField(context, 'Drain Connection Size', 'valve_drain_conn_size', 'Dropdown (Single)', ['No Drain Connection', '15mm', '25mm'], { groupLabel: 'Temperature & Accessory Connections', displayOrder: order++ }),
    makeField(context, 'Vent Connection Size', 'valve_vent_conn_size', 'Dropdown (Single)', ['No Vent Connection', '25mm'], { groupLabel: 'Temperature & Accessory Connections', displayOrder: order++ }),
    makeField(context, 'Lifting Lug Required', 'valve_lifting_lug', 'Dropdown (Single)', ['NO', 'Yes'], { groupLabel: 'Temperature & Accessory Connections', displayOrder: order++ }),
    makeField(context, 'Support Foot Required', 'valve_support_foot', 'Dropdown (Single)', ['NO', 'Yes'], { groupLabel: 'Temperature & Accessory Connections', displayOrder: order++ }),
    makeField(context, 'Fire Safe Design', 'valve_fire_safe', 'Dropdown (Single)', ['No', 'Floating - API 607', 'TMBV - API 6FA'], { groupLabel: 'Temperature & Accessory Connections', displayOrder: order++ }),
    makeField(context, 'Antistatic Device', 'valve_antistatic', 'Dropdown (Single)', ['Yes', 'No'], { groupLabel: 'Temperature & Accessory Connections', displayOrder: order++ }),
    makeField(context, 'Locking Device', 'valve_locking_device', 'Dropdown (Single)', ['NO', 'Yes'], { groupLabel: 'Temperature & Accessory Connections', displayOrder: order++ }),
    makeField(context, 'Is Valve for Pigging', 'valve_for_pigging', 'Dropdown (Single)', ['NO', 'Yes'], { groupLabel: 'Temperature & Accessory Connections', displayOrder: order++ }),
    makeField(context, 'Pressure Relief Valve', 'valve_prv', 'Dropdown (Single)', ['NO', 'Yes'], { groupLabel: 'Temperature & Accessory Connections', displayOrder: order++ }),
    makeField(context, 'Cavity Relief Valve', 'valve_cavity_relief', 'Dropdown (Single)', ['NO', 'Yes'], { groupLabel: 'Temperature & Accessory Connections', displayOrder: order++ }),
    makeField(context, 'By-Pass Connection', 'valve_bypass', 'Dropdown (Single)', ['NO', 'Yes'], { groupLabel: 'Temperature & Accessory Connections', displayOrder: order++ }),
    makeField(context, 'Corrosion Allowance', 'valve_corrosion_allowance', 'Dropdown (Single)', ['1.5mm', '2mm', '3mm', '5mm'], { groupLabel: 'Temperature & Accessory Connections', displayOrder: order++ }),
    makeField(context, 'Extended Bonnet', 'valve_extended_bonnet', 'Dropdown (Single)', ['No', 'Yes'], { groupLabel: 'Temperature & Accessory Connections', displayOrder: order++ }),
    makeField(context, 'Painting (DFT Micron)', 'valve_painting_dft', 'Dropdown (Single)', ['120 Micron', 'Other'], { groupLabel: 'Temperature & Accessory Connections', displayOrder: order++ }),
    makeField(context, 'Dispatch By', 'valve_dispatch_by', 'Dropdown (Single)', ['Road', 'Air', 'Sea'], { groupLabel: 'Temperature & Accessory Connections', displayOrder: order++ }),

    // Materials of Construction (MOC)
    makeField(context, 'Body/Side PC/Bonnet/Trunnion Material', 'valve_moc_body', 'Dropdown (Single)', ['ASTM A216 Gr. WCB', 'ASTM A105', 'ASTM A350 LF2', 'ASTM A352 LCB', 'ASTM A182 F316', 'ASTM A351 CF8M', 'Other'], { groupLabel: 'Materials of Construction (MOC)', displayOrder: order++ }),
    makeField(context, 'Ball/Wedge/Disc Material', 'valve_moc_ball', 'Dropdown (Single)', ['ASTM A216 Gr. WCB + 75 MIC ENP', 'SS316', 'ASTM A216 Gr. WCB + STELLITED', '13% Cr Steel', 'Other'], { groupLabel: 'Materials of Construction (MOC)', displayOrder: order++ }),
    makeField(context, 'Stem/Hinge Material', 'valve_moc_stem', 'Dropdown (Single)', ['ASTM A479 Gr. 410', 'ASTM A182 Gr. F6 cl2', 'SS316', 'ASTM A479 Gr. 316', 'Other'], { groupLabel: 'Materials of Construction (MOC)', displayOrder: order++ }),
    makeField(context, 'Seat Ring / Seat Holder Material', 'valve_moc_seat', 'Dropdown (Single)', ['PTFE', 'RPTFE', 'PTFE + ASTM A182 Gr. F6 cl1', 'RPTFE + ASTM A182 Gr. F6 cl1', 'ASTM A216 Gr. WCB + STELLITED', '13% Cr Steel', 'SS316', 'Other'], { groupLabel: 'Materials of Construction (MOC)', displayOrder: order++ }),
    makeField(context, 'Stud & Nuts Material', 'valve_moc_stud_nuts', 'Dropdown (Single)', ['ASTM A193 Gr. B7 & ASTM A194 Gr. 2H', 'Other'], { groupLabel: 'Materials of Construction (MOC)', displayOrder: order++ }),

    // Testing details
    makeField(context, 'RT Required', 'valve_test_rt', 'Dropdown (Single)', ['NO', 'Yes'], { groupLabel: 'Testing & Quality Assurance', displayOrder: order++ }),
    makeField(context, 'UT Required', 'valve_test_ut', 'Dropdown (Single)', ['NO', 'Yes'], { groupLabel: 'Testing & Quality Assurance', displayOrder: order++ }),
    makeField(context, 'DPT Required', 'valve_test_dpt', 'Dropdown (Single)', ['NO', 'Yes'], { groupLabel: 'Testing & Quality Assurance', displayOrder: order++ }),
    makeField(context, 'MPT Required', 'valve_test_mpt', 'Dropdown (Single)', ['NO', 'Yes'], { groupLabel: 'Testing & Quality Assurance', displayOrder: order++ }),
    makeField(context, 'NACE Requirement', 'valve_nace_req', 'Dropdown (Single)', ['NO', 'Yes'], { groupLabel: 'Testing & Quality Assurance', displayOrder: order++ }),
    makeField(context, 'Fugitive Emission/Helium Test', 'valve_test_fugitive_emission', 'Dropdown (Single)', ['NO', 'Yes'], { groupLabel: 'Testing & Quality Assurance', displayOrder: order++ }),
    makeField(context, 'Cryogenics Test', 'valve_test_cryogenic', 'Dropdown (Single)', ['NO', 'Yes'], { groupLabel: 'Testing & Quality Assurance', displayOrder: order++ }),
    makeField(context, 'Demonstration of Valve Function', 'valve_test_demo_function', 'Dropdown (Single)', ['NO', 'Yes'], { groupLabel: 'Testing & Quality Assurance', displayOrder: order++ }),
    makeField(context, 'IGC Test', 'valve_test_igc', 'Dropdown (Single)', ['NO', 'Yes'], { groupLabel: 'Testing & Quality Assurance', displayOrder: order++ }),
    makeField(context, 'PMI Test', 'valve_test_pmi', 'Dropdown (Single)', ['NO', 'Yes'], { groupLabel: 'Testing & Quality Assurance', displayOrder: order++ }),
    makeField(context, 'Heat Treatment Chart Required', 'valve_heat_treatment_chart', 'Dropdown (Single)', ['NO', 'Yes'], { groupLabel: 'Testing & Quality Assurance', displayOrder: order++ }),
    makeField(context, 'Impact Hardness Test Required', 'valve_test_impact_hardness', 'Dropdown (Single)', ['NO', 'Yes'], { groupLabel: 'Testing & Quality Assurance', displayOrder: order++ }),
    makeField(context, 'Seismic Testing Required', 'valve_test_seismic', 'Dropdown (Single)', ['NO', 'Yes'], { groupLabel: 'Testing & Quality Assurance', displayOrder: order++ }),
    makeField(context, 'IBR/CE Certification Required', 'valve_ibr_ce_cert', 'Dropdown (Single)', ['NO', 'Yes'], { groupLabel: 'Testing & Quality Assurance', displayOrder: order++ }),
    makeField(context, 'Design Validation (API 6D)', 'valve_design_validation', 'Dropdown (Single)', ['NO', 'Yes'], { groupLabel: 'Testing & Quality Assurance', displayOrder: order++ })
  ];
};

const run = async () => {
  await connectDB();

  // Combine Enquiry and Quotation fields
  const allFields = [
    ...getPipingFieldsForContext('Enquiry'),
    ...getPipingFieldsForContext('Quotation')
  ];

  console.log(`\n📦 Seeding ${allFields.length} Piping / Valve fields...\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  // Clear any existing piping fields to avoid junk options clashing
  await FieldDefinition.deleteMany({ productCategory: { $in: ['Piping', 'Piping / Valves', 'Valves'] } });
  console.log(`🧹 Cleared old Piping, Piping / Valves, and Valves fields from database.`);

  for (const field of allFields) {
    try {
      await FieldDefinition.findOneAndUpdate(
        { formContext: field.formContext, fieldName: field.fieldName },
        { $set: field },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`  ✅ [${field.formContext} - ${field.groupLabel}] ${field.fieldLabel}`);
      created++;
    } catch (err) {
      console.error(`  ❌ [${field.formContext} - ${field.groupLabel}] ${field.fieldLabel} — ${err.message}`);
      errors++;
    }
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`✅ Done! Created/Updated: ${created}, Errors: ${errors}`);
  console.log(`─────────────────────────────────────────\n`);

  process.exit(0);
};

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

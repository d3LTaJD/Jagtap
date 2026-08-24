/**
 * Database Migration Script: Fix FieldDefinition Options for valve_type
 * 
 * Ensures all industrial valve types (Ball Valve, Gate Valve, Globe Valve, Check Valve,
 * Butterfly Valve, Plug Valve, Control Valve, Needle Valve, Safety Valve) are in the
 * allowed options array for valve_type field definitions in MongoDB.
 * 
 * Usage: node src/scripts/fixValveTypeFieldOptions.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const FieldDefinition = require('../models/FieldDefinition');

const COMPLETE_VALVE_TYPES = [
  'Ball Valve',
  'Floating Ball Valve',
  'Trunnion Mounted Ball Valve',
  'Gate Valve',
  'Wedge Gate Valve',
  'Knife Gate Valve',
  'Globe Valve',
  'Check Valve',
  'Swing Check Valve',
  'Lift Check Valve',
  'Dual Plate Check Valve',
  'Non Return Valve',
  'Butterfly Valve',
  'Plug Valve',
  'Control Valve',
  'Needle Valve',
  'Safety Valve',
  'Pressure Relief Valve'
];

async function runMigration() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[Migration] Connected to MongoDB...');

  const fields = await FieldDefinition.find({ fieldName: 'valve_type' });
  console.log(`[Migration] Found ${fields.length} FieldDefinition records for valve_type.`);

  for (const field of fields) {
    const existingOptions = field.options || [];
    const mergedOptions = [...new Set([...existingOptions, ...COMPLETE_VALVE_TYPES])];

    field.options = mergedOptions;
    await field.save();
    console.log(`[Migration] Updated FieldDefinition ${field._id} (${field.formContext}). Options count: ${mergedOptions.length}`);
  }

  await mongoose.disconnect();
  console.log('[Migration] Completed successfully! ✅');
}

runMigration().catch(err => {
  console.error('[Migration] Failed:', err);
  process.exit(1);
});

/**
 * DB Cleanup & Migration Script
 * Fixes Customer State Contamination in MongoDB by resetting generic email accounts (@gmail.com)
 * and backfilling senderCompany on existing enquiries.
 *
 * Usage: node src/scripts/fixCustomerStateContamination.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const Customer = require('../models/Customer');
const FieldDefinition = require('../models/FieldDefinition');
const Enquiry = require('../models/Enquiry');

async function fixState() {
  const uri = process.env.MONGODB_URI;
  console.log('[Migration] Connecting to MongoDB...');
  await mongoose.connect(uri);

  // 1. Reset jeetdodia12@gmail.com customer record to Individual Customer
  const customer = await Customer.findOne({ emailAddress: 'jeetdodia12@gmail.com' });
  if (customer) {
    console.log(`[Migration] Found Customer ${customer._id} (${customer.companyName}). Resetting to "Individual Customer".`);
    customer.companyName = 'Individual Customer';
    customer.primaryContactName = 'Jeet Dodia';
    await customer.save();
    console.log(`[Migration] Customer ${customer._id} reset successfully ✅`);
  } else {
    console.log('[Migration] Customer jeetdodia12@gmail.com not found.');
  }

  // 2. Backfill ENQ-2026-07-0019 (Ball Valves & Check Valves for IOCL)
  const enq19 = await Enquiry.findOne({ enquiryId: 'ENQ-2026-07-0019' });
  if (enq19) {
    enq19.senderCompany = 'Sri Akshaya Engineering Pvt. Ltd.';
    await enq19.save();
    console.log(`[Migration] Updated ${enq19.enquiryId}: senderCompany set to "${enq19.senderCompany}" ✅`);
  }

  // 3. Backfill ENQ-2026-07-0018 (Shut Off Valve for JNPA project)
  const enq18 = await Enquiry.findOne({ enquiryId: 'ENQ-2026-07-0018' });
  if (enq18) {
    enq18.senderCompany = 'Individual Customer';
    await enq18.save();
    console.log(`[Migration] Updated ${enq18.enquiryId}: senderCompany set to "${enq18.senderCompany}" ✅`);
  }

  // 4. Verify all Enquiries
  console.log('\n--- VERIFICATION: ALL ENQUIRIES AFTER MIGRATION ---');
  const allEnquiries = await Enquiry.find({}).populate('customer');
  allEnquiries.forEach(e => {
    console.log(`Enquiry ${e.enquiryId}:
  - Sender Company: "${e.senderCompany || 'N/A'}"
  - Customer Record Company: "${e.customer?.companyName || 'N/A'}"
  - Client / Owner: "${e.clientName || 'N/A'}"
    `);
  });

  await mongoose.disconnect();
  console.log('[Migration] Complete ✅');
}

fixState().catch(err => {
  console.error('[Migration] Error:', err);
  process.exit(1);
});

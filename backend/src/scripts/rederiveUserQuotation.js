const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Enquiry = require('../models/Enquiry');
const Quotation = require('../models/Quotation');
const FieldDefinition = require('../models/FieldDefinition');
const EngineeringRulesEngine = require('../services/extraction/EngineeringRulesEngine');

async function rederive() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const enqId = '6aa7de141e04d9bcf61b4083';
  const quotId = '6aa7de9e3f159d57c27300c2';

  const enquiry = await Enquiry.findById(enqId);
  if (!enquiry) {
    console.error('Enquiry not found:', enqId);
    return;
  }
  console.log(`Found Enquiry ${enquiry.enquiryId} with ${enquiry.products.length} products`);

  const quotation = await Quotation.findById(quotId);
  if (!quotation) {
    console.error('Quotation not found:', quotId);
    return;
  }
  console.log(`Found Quotation ${quotation.quotationId} with ${quotation.items.length} items`);

  // Loop over each product in enquiry
  enquiry.products.forEach((prod, idx) => {
    const desc = prod.description || '';
    console.log(`\nEvaluating Product ${idx + 1}: ${desc}`);
    
    // Evaluate engineering rules
    const rules = EngineeringRulesEngine.evaluateContractReviewRules({
      valveType: prod.dynamicFields?.valve_type || prod.category,
      valveSize: prod.dynamicFields?.valve_size || '50',
      valveClass: prod.dynamicFields?.valve_class || '150#',
      bodyMoc: prod.dynamicFields?.valve_body_moc,
      ballMoc: prod.dynamicFields?.valve_ball_moc,
      stemMoc: prod.dynamicFields?.valve_stem_moc,
      seatMoc: prod.dynamicFields?.valve_seat_ring_moc,
      studsMoc: prod.dynamicFields?.valve_fasteners_moc,
      customerTestingStd: prod.standardCode,
      description: desc
    });

    if (rules && rules.derived) {
      // Merge into dynamicFields
      prod.dynamicFields = {
        ...(prod.dynamicFields || {}),
        ...rules.derived
      };
      // Explicitly ensure canonical component MOCs
      if (rules.derived.moc_body) {
        prod.dynamicFields.valve_moc_body = rules.derived.moc_body;
        prod.dynamicFields.valve_body_moc = rules.derived.moc_body;
      }
      if (rules.derived.moc_ball) {
        prod.dynamicFields.valve_moc_ball = rules.derived.moc_ball;
        prod.dynamicFields.valve_ball_moc = rules.derived.moc_ball;
      }
      if (rules.derived.moc_stem) {
        prod.dynamicFields.valve_moc_stem = rules.derived.moc_stem;
        prod.dynamicFields.valve_stem_moc = rules.derived.moc_stem;
      }
      if (rules.derived.moc_seat) {
        prod.dynamicFields.valve_moc_seat = rules.derived.moc_seat;
        prod.dynamicFields.valve_seat_ring_moc = rules.derived.moc_seat;
      }
      if (rules.derived.moc_stud_nuts) {
        prod.dynamicFields.valve_moc_stud_nuts = rules.derived.moc_stud_nuts;
        prod.dynamicFields.valve_fasteners_moc = rules.derived.moc_stud_nuts;
      }

      console.log(`Product ${idx + 1} MOCs:`);
      console.log(`  Body: ${prod.dynamicFields.valve_body_moc}`);
      console.log(`  Ball/Trim: ${prod.dynamicFields.valve_ball_moc}`);
      console.log(`  Stem: ${prod.dynamicFields.valve_stem_moc}`);
      console.log(`  Seat: ${prod.dynamicFields.valve_seat_ring_moc}`);
      console.log(`  Fasteners: ${prod.dynamicFields.valve_fasteners_moc}`);
    }
  });

  enquiry.markModified('products');
  await enquiry.save();
  console.log('\nSaved updated Enquiry to DB');

  // Update Quotation items
  quotation.items.forEach((item, idx) => {
    const matchingProd = enquiry.products[idx];
    if (matchingProd) {
      item.dynamicFields = {
        ...(item.dynamicFields || {}),
        ...(matchingProd.dynamicFields || {})
      };
    }
  });

  quotation.markModified('items');
  await quotation.save();
  console.log('Saved updated Quotation to DB');

  await mongoose.disconnect();
}

rederive().catch(console.error);

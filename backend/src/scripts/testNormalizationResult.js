const mongoose = require('mongoose');
const FieldDefinition = require('../models/FieldDefinition');
const aiService = require('../services/aiService');

async function test() {
  const f = {
    fieldType: 'Dropdown (Single)',
    options: [
      '15',   '20',   '25',   '32',
      '40',   '50',   '65',   '80',
      '100',  '150',  '200',  '250',
      '300',  '350',  '400',  '450',
      '500',  '550',  '600',  '650',
      '700',  '750',  '800',  '850',
      '900',  '950',  '1000', '1050',
      '1200', '1350', '1400', '1500'
    ]
  };

  const fields = {
    valve_size: f
  };

  const extracted = {
    valve_size: '20'
  };

  const normalized = aiService.normalizeExtractedFields(extracted, fields);
  console.log('Normalized output for valve_size "20":', normalized.valve_size);
}

test().catch(console.error);

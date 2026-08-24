const mongoose = require('mongoose');

const validationLogSchema = new mongoose.Schema({
  enquiryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Enquiry', index: true },
  lineItemId: { type: String, index: true },
  productIndex: { type: Number, default: 0 },
  field: { type: String, required: true },
  aiValue: { type: mongoose.Schema.Types.Mixed, default: null },
  regexValue: { type: mongoose.Schema.Types.Mixed, default: null },
  finalValue: { type: mongoose.Schema.Types.Mixed, default: null },
  validation: { 
    type: String, 
    enum: ['PASSED', 'REJECTED', 'OVERRIDDEN', 'FALLBACK'],
    required: true 
  },
  rejectionReason: { type: String, default: '' },
  source: { type: String, default: 'EngineeringDictionary' },
  confidenceBefore: { type: Number, default: 0 },
  confidenceAfter: { type: Number, default: 0 }
}, { timestamps: true });

validationLogSchema.index({ enquiryId: 1, field: 1 });

module.exports = mongoose.model('ValidationLog', validationLogSchema);

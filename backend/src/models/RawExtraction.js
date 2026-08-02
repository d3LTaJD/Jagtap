const mongoose = require('mongoose');

const rawExtractionSchema = new mongoose.Schema({
  enquiryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Enquiry', index: true },
  productIndex: { type: Number, default: 0 },
  documentId: { type: String, default: 'EMAIL_BODY' },
  pageNumber: { type: Number, default: 1 },
  field: { type: String, required: true, index: true },
  rawValue: { type: mongoose.Schema.Types.Mixed },
  normalizedValue: { type: mongoose.Schema.Types.Mixed },
  extractionMethod: { 
    type: String, 
    enum: ['REGEX', 'AI', 'BOQ_PARSER', 'TENDER_SOR', 'USER_MANUAL', 'HEURISTIC'],
    required: true 
  },
  aiResponse: { type: mongoose.Schema.Types.Mixed },
  confidence: { type: Number, default: 0 },
  validationState: { 
    type: String, 
    enum: ['VALID', 'INVALID', 'AMBIGUOUS', 'NOT_FOUND'],
    default: 'NOT_FOUND' 
  },
  validationReason: { type: String, default: '' },
  sourceText: { type: String, default: '' },
  isAccepted: { type: Boolean, default: false },
  rejectionReason: { type: String, default: '' }
}, { timestamps: true });

rawExtractionSchema.index({ enquiryId: 1, field: 1 });

module.exports = mongoose.model('RawExtraction', rawExtractionSchema);

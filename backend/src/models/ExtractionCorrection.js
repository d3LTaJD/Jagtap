const mongoose = require('mongoose');

const extractionCorrectionSchema = new mongoose.Schema({
  enquiryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Enquiry', index: true },
  productIndex: { type: Number, default: 0 },
  fieldCategory: { type: String, required: true }, // 'valve', 'size', 'class', 'material', 'connection'
  field: { type: String, required: true },
  wrongValue: { type: String, default: '' },
  correctValue: { type: String, required: true },
  context: { type: String, default: '' },
  correctedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  appliedToKnowledge: { type: Boolean, default: false }
}, { timestamps: true });

extractionCorrectionSchema.index({ fieldCategory: 1, wrongValue: 1 });

module.exports = mongoose.model('ExtractionCorrection', extractionCorrectionSchema);

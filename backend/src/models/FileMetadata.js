const mongoose = require('mongoose');

const fileMetadataSchema = new mongoose.Schema({
  fileName: { type: String, required: true },
  originalName: { type: String, required: true },
  fileKey: { type: String, required: true, unique: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  module: { type: String, enum: ['Enquiry', 'Quotation', 'QAP', 'FollowUp', 'General', 'Temp', 'Task'], required: true, default: 'Temp' },
  entityId: { type: mongoose.Schema.Types.ObjectId },
  isPrivate: { type: Boolean, default: true },
  revisionNumber: { type: Number },
  isGeneratedPdf: { type: Boolean, default: false },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

// Add index for fast exact matches
fileMetadataSchema.index({ entityId: 1, module: 1 });

module.exports = mongoose.model('FileMetadata', fileMetadataSchema);

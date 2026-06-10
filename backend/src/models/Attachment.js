const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  linkedEnquiries: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Enquiry', index: true }], // Bidirectional many-to-many
  threadId: { type: String, required: true, index: true },
  originalMessageId: { type: String, required: true, index: true },
  originalFileName: { type: String, required: true },
  fileType: { type: String, required: true },
  fileSize: { type: Number, required: true },
  storagePath: { type: String, required: true }, // Local storage file path / filename key
  extractedText: { type: String, default: '' }, // Extracted text/OCR content stored permanently
  extractionStatus: { type: String, enum: ['PENDING', 'SUCCESS', 'FAILED', 'NOT_SUPPORTED'], default: 'PENDING' },
  ocrConfidence: { type: Number }, // Raw OCR confidence (0-100)
  attachmentCategory: { type: String, enum: ['Datasheet', 'Drawing', 'Commercial', 'Unknown'], default: 'Unknown' },
  
  // Version Control
  versionNumber: { type: Number, default: 1 },
  parentAttachmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attachment', default: null, index: true },
  isLatestVersion: { type: Boolean, default: true, index: true },
  
  // Ownership and Classification
  attachmentOwnerType: { 
    type: String, 
    enum: ['Customer', 'Vendor', 'Internal', 'SystemGenerated'], 
    default: 'Customer',
    index: true 
  },
  
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now },
  processingStatus: { type: String, enum: ['Pending', 'Processing', 'Completed', 'Failed'], default: 'Pending', index: true },
  processingMessage: { type: String },
  processingStartedAt: { type: Date },
  processingCompletedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Attachment', attachmentSchema);

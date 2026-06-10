const mongoose = require('mongoose');

const systemAuditLogSchema = new mongoose.Schema({
  eventType: { 
    type: String, 
    required: true, 
    enum: [
      'INGESTION', 
      'OCR', 
      'AI_EXTRACTION', 
      'QUEUE_EXECUTION', 
      'STATUS_TRANSITION', 
      'VERIFICATION', 
      'FILE_UPLOAD', 
      'QUOTATION_GENERATION'
    ], 
    index: true 
  },
  entityType: { type: String, required: true, index: true }, // e.g. EmailMessage, Attachment, Enquiry, Quotation
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  action: { type: String, required: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Can be null for system tasks
  timestamp: { type: Date, default: Date.now, index: true },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('SystemAuditLog', systemAuditLogSchema);

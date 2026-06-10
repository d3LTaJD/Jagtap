const mongoose = require('mongoose');

const emailMessageSchema = new mongoose.Schema({
  messageId: { type: String, unique: true, sparse: true, index: true },
  threadId: { type: String, required: true, index: true },
  sender: { type: String, required: true },
  recipients: [{ type: String }],
  cc: [{ type: String }],
  bcc: [{ type: String }],
  subject: { type: String, required: true },
  bodyText: { type: String },
  htmlBody: { type: String },
  attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Attachment' }],
  receivedAt: { type: Date, required: true },
  processedAt: { type: Date, default: Date.now },
  processingStatus: { type: String, enum: ['Pending', 'Processing', 'Completed', 'Failed'], default: 'Pending', index: true },
  processingMessage: { type: String },
  processingStartedAt: { type: Date },
  processingCompletedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('EmailMessage', emailMessageSchema);

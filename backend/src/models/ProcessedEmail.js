const mongoose = require('mongoose');

const processedEmailSchema = new mongoose.Schema({
  messageId: { type: String, unique: true, sparse: true, index: true },
  contentHash: { type: String, unique: true, index: true }, // SHA256 of sender + subject + bodyText
  sender: { type: String },
  subject: { type: String },
  processedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ProcessedEmail', processedEmailSchema);

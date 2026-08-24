const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true },
  type: { type: String, enum: ['OTP', 'INVITE'], required: true },
  attempts: { type: Number, default: 0 },
  expires_at: { type: Date, required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('Token', tokenSchema);

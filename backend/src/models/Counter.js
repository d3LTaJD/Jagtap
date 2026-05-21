const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Key name for the sequence (e.g. prefix 'ENQ-2026-05-' or 'user')
  seq: { type: Number, default: 0 }      // Current sequence index
});

module.exports = mongoose.model('Counter', counterSchema);

const mongoose = require('mongoose');

const metricsSchema = new mongoose.Schema({
  metricName: { type: String, required: true, index: true }, // e.g. IngestionRate, OcrSuccessRate, AiSuccessRate, QuotationConversion, QueueLatency
  value: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('Metrics', metricsSchema);

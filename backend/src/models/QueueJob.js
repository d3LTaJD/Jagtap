const mongoose = require('mongoose');

const queueJobSchema = new mongoose.Schema({
  queueName: { 
    type: String, 
    required: true,
    enum: [
      'EmailProcessingQueue',
      'OCRProcessingQueue',
      'DocumentParsingQueue',
      'AIExtractionQueue',
      'AttachmentReprocessingQueue',
      'ConfidenceCalculationQueue',
      'NotificationQueue'
    ],
    index: true 
  },
  payload: { type: mongoose.Schema.Types.Mixed }, // Renamed from data
  data: { type: mongoose.Schema.Types.Mixed }, // Keep data for backward compatibility
  status: { 
    type: String, 
    enum: ['Pending', 'Processing', 'Completed', 'Failed'], 
    default: 'Pending',
    index: true
  },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  lockedBy: { type: String, default: null }, // Worker process ID / hostname
  lockedAt: { type: Date, default: null },
  lastError: { type: String, default: null },
  nextRetryAt: { type: Date, index: true, default: null },
  errorLogs: [
    {
      timestamp: { type: Date, default: Date.now },
      message: String,
      stack: String
    }
  ],
  startedAt: { type: Date },
  completedAt: { type: Date },
  failedAt: { type: Date }
}, { timestamps: true });

// Pre-save hook to keep data and payload in sync
queueJobSchema.pre('save', function(next) {
  if (this.payload && !this.data) {
    this.data = this.payload;
  } else if (this.data && !this.payload) {
    this.payload = this.data;
  }
  next();
});

module.exports = mongoose.model('QueueJob', queueJobSchema);

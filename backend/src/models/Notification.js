const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Alias field for new API
  type: { 
    type: String, 
    enum: [
      'ENQUIRY_ASSIGNED', 'FOLLOWUP_REMINDER', 'FOLLOWUP_OVERDUE',
      'QUOTE_APPROVAL', 'QUOTATION_ASSIGNED', 'QUOTATION_APPROVED',
      'QAP_APPROVAL', 'ESCALATION', 'INFO', 'SYSTEM',
      'TASK_ASSIGNED', 'TASK_COMPLETED',
      'REMINDER', 'FOLLOW_UP', 'URGENT_LEAD', 'ENQUIRY_LOST',
      'LOW_CONFIDENCE_ENQUIRY', 'NEW_CUSTOMER_ATTACHMENT', 'VERIFICATION_REQUIRED',
      'READY_FOR_OFFER', 'QUOTATION_CREATED', 'PROCESSING_FAILED',
      'OCR_FAILED', 'AI_EXTRACTION_FAILED', 'DUPLICATE_EMAIL_DETECTED'
    ],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  related_id: { type: mongoose.Schema.Types.ObjectId, required: false },
  entityType: { type: String }, // e.g. Enquiry, Quotation, Attachment
  entityId: { type: mongoose.Schema.Types.ObjectId },
  is_read: { type: Boolean, default: false },
  isRead: { type: Boolean, default: false } // Alias field for new API
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Add pre-save hook to keep aliases in sync
notificationSchema.pre('save', function(next) {
  if (this.userId) this.user_id = this.userId;
  if (!this.userId && this.user_id) this.userId = this.user_id;
  
  if (this.isRead !== undefined) this.is_read = this.isRead;
  if (this.is_read !== undefined && this.isRead === undefined) this.isRead = this.is_read;
  
  next();
});

module.exports = mongoose.model('Notification', notificationSchema);

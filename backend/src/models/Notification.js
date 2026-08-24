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
      'OCR_FAILED', 'AI_EXTRACTION_FAILED', 'DUPLICATE_EMAIL_DETECTED',
      'QUOTATION_APPROVED_BY_DIRECTOR', 'DRAWING_REQUEST_CREATED', 'DRAWING_SUBMITTED_FOR_REVIEW',
      'VENDOR_DRAWING_SLA_BREACH', 'DRAWING_DELAY_ESCALATED', 'DRAWING_APPROVED', 'DRAWING_REJECTED',
      'WORK_ORDER_RELEASED', 'CLIENT_QUOTATION_REPLY_DETECTED',
      'BOM_GENERATED', 'BOM_CONFIRMED', 'PR_CREATED', 'PO_ISSUED', 'PI_RECEIVED', 'PI_MATCHED_CLEAN', 'PI_DEVIATION_ALERT', 'CPD_RISK_ALERT'
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

const mongoose = require('mongoose');

const workOrderItemSchema = new mongoose.Schema({
  itemNo: { type: Number, required: true },
  description: { type: String, required: true },
  size: { type: String, default: '' },
  pressureClass: { type: String, default: '' },
  valveType: { type: String, default: '' },
  materialGrade: { type: String, default: '' },
  endConnection: { type: String, default: '' },
  quantity: { type: Number, required: true, default: 1 },
  unit: { type: String, default: 'NOS' },
  tagNumber: { type: String, default: '' },
  unitRate: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 }
}, { _id: false });

const workOrderSchema = new mongoose.Schema({
  workOrderId: { type: String, unique: true, required: true, index: true }, // WO-YYYY-MM-NNNN or P-YYMMNNN
  quotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', required: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  orderAcceptance: { type: mongoose.Schema.Types.ObjectId, ref: 'OrderAcceptance', index: true },
  customerProformaInvoice: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerProformaInvoice', index: true },
  drawing: { type: mongoose.Schema.Types.ObjectId, ref: 'Drawing', index: true },
  qap: { type: mongoose.Schema.Types.ObjectId, ref: 'Qap', index: true },

  customerPoNumber: { type: String, index: true },
  customerPoDate: { type: Date },
  customerDeliveryDate: { type: Date },

  // Stage Lifecycle Tracking
  stage: {
    type: String,
    enum: [
      'STAGE_1_PO_RECEIVED',
      'STAGE_2_ADVANCE_RECEIVED',
      'STAGE_3_GAD_QAP_APPROVED',
      'STAGE_4_RELEASED_TO_PLANNING',
      'STAGE_5_IN_PRODUCTION',
      'STAGE_6_COMPLETED'
    ],
    default: 'STAGE_1_PO_RECEIVED',
    index: true
  },

  status: {
    type: String,
    enum: [
      'DRAFT',
      'AWAITING_ADVANCE_PAYMENT',
      'AWAITING_GAD_QAP_APPROVAL',
      'PENDING_DRAWING_APPROVAL',
      'READY_FOR_RELEASE',
      'RELEASED',
      'IN_PRODUCTION',
      'COMPLETED',
      'CANCELLED'
    ],
    default: 'AWAITING_ADVANCE_PAYMENT',
    index: true
  },

  // Milestone Gates
  // Gate 1: 10% Advance Payment Gate
  isAdvanceReceived: { type: Boolean, default: false, index: true },
  advanceReceivedAmount: { type: Number, default: 0 },
  advanceReceivedAt: { type: Date },
  advancePaymentRef: { type: String, default: '' }, // Bank UTR No.

  // Gate 2: GAD Drawing Approval Gate
  isDrawingApproved: { type: Boolean, default: false, index: true },
  selectedRevisionNumber: { type: Number },
  approvedDrawingRevision: { type: Number },
  approvedDrawingLabel: { type: String }, // e.g. "Rev 02"
  gadApprovedAt: { type: Date },

  // Gate 3: QAP Approval Gate
  isQapApproved: { type: Boolean, default: false, index: true },
  approvedQapRevision: { type: Number },
  approvedQapLabel: { type: String }, // e.g. "Rev 00"
  qapApprovedAt: { type: Date },

  frozenRevisionSnapshot: { type: mongoose.Schema.Types.Mixed }, // Permanent frozen snapshot on release

  releasedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  releasedAt: { type: Date },
  releaseNotes: { type: String, default: '' },

  items: [workOrderItemSchema],

  targetDeliveryDate: { type: Date },
  productionNotes: { type: String, default: '' }
}, { timestamps: true });

workOrderSchema.index({ status: 1, isDrawingApproved: 1, isAdvanceReceived: 1 });

module.exports = mongoose.model('WorkOrder', workOrderSchema);

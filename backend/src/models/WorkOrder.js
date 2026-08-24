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
  tagNumber: { type: String, default: '' }
}, { _id: false });

const workOrderSchema = new mongoose.Schema({
  workOrderId: { type: String, unique: true, required: true, index: true }, // WO-YYYY-MM-NNNN
  quotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', required: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  drawing: { type: mongoose.Schema.Types.ObjectId, ref: 'Drawing', required: true, index: true },

  status: {
    type: String,
    enum: ['DRAFT', 'PENDING_DRAWING_APPROVAL', 'RELEASED', 'IN_PRODUCTION', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING_DRAWING_APPROVAL',
    index: true
  },

  // Authoritative Hard Drawing Gate fields
  isDrawingApproved: { type: Boolean, default: false, index: true },
  selectedRevisionNumber: { type: Number },
  approvedDrawingRevision: { type: Number },
  approvedDrawingLabel: { type: String }, // e.g. "Rev 02"
  frozenRevisionSnapshot: { type: mongoose.Schema.Types.Mixed }, // Permanent frozen snapshot on release

  releasedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  releasedAt: { type: Date },
  releaseNotes: { type: String, default: '' },

  items: [workOrderItemSchema],

  targetDeliveryDate: { type: Date },
  productionNotes: { type: String, default: '' }
}, { timestamps: true });

workOrderSchema.index({ status: 1, isDrawingApproved: 1 });

module.exports = mongoose.model('WorkOrder', workOrderSchema);

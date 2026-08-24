const mongoose = require('mongoose');

const piDeviationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['PRICE_VARIANCE', 'QUANTITY_VARIANCE', 'DELIVERY_DELAY', 'SPEC_MISMATCH', 'EXTRA_ITEM', 'MISSING_ITEM'],
    required: true
  },
  severity: {
    type: String,
    enum: ['INFO', 'WARNING', 'CRITICAL'],
    default: 'WARNING'
  },
  itemNo: { type: Number },
  description: { type: String, required: true },
  poValue: { type: mongoose.Schema.Types.Mixed },
  piValue: { type: mongoose.Schema.Types.Mixed },
  variance: { type: Number }, // numeric difference e.g. +2500 or +5 days
  variancePercent: { type: Number }, // e.g. +5.5%
  reason: { type: String, required: true }, // e.g. "Price increased by 10% exceeding configured 5% tolerance"
  status: {
    type: String,
    enum: ['PENDING_REVIEW', 'ACCEPTED_OVERRIDE', 'REJECTED'],
    default: 'PENDING_REVIEW'
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date }
}, { _id: true });

const piItemSchema = new mongoose.Schema({
  itemNo: { type: Number, required: true },
  description: { type: String, required: true },
  materialGrade: { type: String },
  size: { type: String },
  quantity: { type: Number, required: true },
  unit: { type: String, default: 'NOS' },
  unitRate: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  taxAmount: { type: Number, default: 0 },
  promisedDispatchDate: { type: Date },
  vendorHeatNo: { type: String, default: '' },
  matchStatus: {
    type: String,
    enum: ['MATCHED', 'PRICE_MISMATCH', 'QTY_MISMATCH', 'SPEC_MISMATCH', 'EXTRA_ITEM'],
    default: 'MATCHED'
  }
}, { _id: true });

const proformaInvoiceSchema = new mongoose.Schema({
  piId: { type: String, unique: true, required: true, index: true }, // PI-YYYY-MM-NNNN
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
  matchedPo: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true, index: true },
  
  // Permanent Procurement Traceability inherited from PO
  hitNumber: { type: String, required: true }, // e.g. "HIT-2026-0001"

  piNumber: { type: String, required: true }, // Vendor's invoice number
  piDate: { type: Date, default: Date.now },

  fileUrl: { type: String },
  fileName: { type: String },
  inboundEmailId: { type: String },

  items: [piItemSchema],

  totalAmount: { type: Number, required: true },
  taxAmount: { type: Number, default: 0 },
  grandTotal: { type: Number, required: true },
  promisedDeliveryDate: { type: Date },

  // AUTOMATED 2-WAY RECONCILIATION & DEVIATION ENGINE
  reconciliationStatus: {
    type: String,
    enum: ['MATCHED_CLEAN', 'DEVIATIONS_DETECTED', 'MANUALLY_OVERRIDDEN', 'REJECTED'],
    default: 'DEVIATIONS_DETECTED',
    index: true
  },

  deviations: [piDeviationSchema],
  toleranceUsed: {
    priceTolerancePercent: { type: Number, default: 5 },
    qtyTolerancePercent: { type: Number, default: 0 },
    deliveryToleranceDays: { type: Number, default: 2 }
  },

  isCleanMatch: { type: Boolean, default: false, index: true },

  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  reviewNotes: { type: String, default: '' }
}, { timestamps: true });

proformaInvoiceSchema.index({ matchedPo: 1, piNumber: 1 });
proformaInvoiceSchema.index({ hitNumber: 1 });

module.exports = mongoose.model('ProformaInvoice', proformaInvoiceSchema);

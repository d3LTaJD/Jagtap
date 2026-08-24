const mongoose = require('mongoose');

const poItemSchema = new mongoose.Schema({
  itemNo: { type: Number, required: true },
  description: { type: String, required: true },
  category: { type: String },
  materialGrade: { type: String, required: true },
  size: { type: String, default: '' },
  quantity: { type: Number, required: true, min: 1 },
  unit: { type: String, default: 'NOS' },
  unitRate: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  hsnCode: { type: String, default: '8481' },
  gstRate: { type: Number, default: 18 }
}, { _id: true });

const purchaseOrderSchema = new mongoose.Schema({
  poId: { type: String, unique: true, required: true, index: true }, // PO-YYYY-MM-NNNN
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
  workOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder', index: true },
  bom: { type: mongoose.Schema.Types.ObjectId, ref: 'BillOfMaterials', index: true },
  requisitions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseRequisition' }],

  // PERMANENT PROCUREMENT TRACEABILITY: Mandatory HIT-YYYY-NNNN format (No monthly format)
  hitNumber: { type: String, required: true }, // e.g. "HIT-2026-0001"

  items: [poItemSchema],

  totalAmount: { type: Number, required: true, default: 0 },
  taxAmount: { type: Number, default: 0 },
  grandTotal: { type: Number, required: true, default: 0 },

  poDate: { type: Date, default: Date.now },
  expectedDeliveryDate: { type: Date, required: true },

  // CPD-BASED PROCUREMENT TIMELINE BREAKDOWN (Separately Stored Components)
  cpdDate: { type: Date },                                  // Customer Promised Delivery Date
  vendorLeadTimeDays: { type: Number, default: 15 },        // Component 1: Vendor Manufacturing & Transit (days)
  qcInspectionDays: { type: Number, default: 3 },          // Component 2: Inward QC & Material Testing (days)
  machiningBufferDays: { type: Number, default: 5 },       // Component 3: Assembly, Machining & Testing Buffer (days)
  totalProcurementLeadDays: { type: Number, default: 23 },  // Total Lead Time = 15 + 3 + 5
  latestProcurementStartDate: { type: Date },               // Latest Start = CPD - Total Lead Time
  isCpdRisk: { type: Boolean, default: false, index: true },
  cpdRiskLevel: {
    type: String,
    enum: ['ON_TRACK', 'MODERATE_RISK', 'CRITICAL_RISK'],
    default: 'ON_TRACK',
    index: true
  },
  cpdRiskReason: { type: String, default: '' },

  status: {
    type: String,
    enum: ['DRAFT', 'ISSUED_TO_VENDOR', 'PI_RECEIVED', 'PI_MATCHED', 'PARTIALLY_DELIVERED', 'COMPLETED', 'CANCELLED'],
    default: 'ISSUED_TO_VENDOR',
    index: true
  },

  proformaInvoice: { type: mongoose.Schema.Types.ObjectId, ref: 'ProformaInvoice' },

  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  issuedAt: { type: Date, default: Date.now },
  notes: { type: String, default: '' }
}, { timestamps: true });

purchaseOrderSchema.index({ hitNumber: 1, status: 1 });
purchaseOrderSchema.index({ vendor: 1, poDate: -1 });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);

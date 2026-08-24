const mongoose = require('mongoose');

const prItemSchema = new mongoose.Schema({
  partName: { type: String, required: true },
  materialGrade: { type: String, required: true },
  dimensions: { type: String, default: '' },
  quantity: { type: Number, required: true, min: 1 },
  unit: { type: String, default: 'NOS' },
  targetDeliveryDate: { type: Date },
  estimatedUnitCost: { type: Number, default: 0 },
  suggestedVendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  suggestedVendorName: { type: String }
}, { _id: true });

const purchaseRequisitionSchema = new mongoose.Schema({
  prId: { type: String, unique: true, required: true, index: true }, // PR-YYYY-MM-NNNN
  bom: { type: mongoose.Schema.Types.ObjectId, ref: 'BillOfMaterials', required: true, index: true },
  workOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder', required: true, index: true },
  
  category: {
    type: String,
    enum: ['Raw Casting/Forging', 'Machined Trim', 'Fasteners', 'Gaskets & Seals', 'Hardware/Accessories'],
    required: true,
    index: true
  },

  items: [prItemSchema],

  priority: {
    type: String,
    enum: ['URGENT', 'HIGH', 'MEDIUM', 'ROUTINE'],
    default: 'HIGH'
  },

  status: {
    type: String,
    enum: ['OPEN', 'PO_CREATED', 'CANCELLED'],
    default: 'OPEN',
    index: true
  },

  purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, default: '' }
}, { timestamps: true });

purchaseRequisitionSchema.index({ bom: 1, category: 1 });

module.exports = mongoose.model('PurchaseRequisition', purchaseRequisitionSchema);

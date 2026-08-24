const mongoose = require('mongoose');

const bomComponentSchema = new mongoose.Schema({
  itemNo: { type: Number, required: true },
  partName: { type: String, required: true },
  category: {
    type: String,
    enum: ['Raw Casting/Forging', 'Machined Trim', 'Fasteners', 'Gaskets & Seals', 'Hardware/Accessories'],
    required: true
  },
  materialGrade: { type: String, required: true },
  dimensions: { type: String, default: '' },
  bomMultiplier: { type: Number, default: 1 }, // per valve multiplier e.g. Body = 1, Seat Ring = 2, Body Studs = 8
  
  totalRequiredQty: { type: Number, required: true, min: 1 },
  unit: { type: String, default: 'NOS' },

  // Inventory & Shortage allocation
  inStockQty: { type: Number, default: 0 },
  reservedStockQty: { type: Number, default: 0 },
  shortageQty: { type: Number, default: 0 },

  suggestedVendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  suggestedVendorName: { type: String },
  estimatedLeadTimeDays: { type: Number, default: 7 },
  estimatedUnitCost: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ['AUTO_SUGGESTED', 'ADJUSTED', 'CONFIRMED', 'PR_GENERATED'],
    default: 'AUTO_SUGGESTED'
  }
}, { _id: true });

const billOfMaterialsSchema = new mongoose.Schema({
  bomId: { type: String, unique: true, required: true, index: true }, // BOM-YYYY-MM-NNNN
  workOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder', required: true, unique: true, index: true },
  quotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', index: true },
  drawing: { type: mongoose.Schema.Types.ObjectId, ref: 'Drawing', index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', index: true },

  valveSpecs: {
    valveType: { type: String, required: true },      // e.g. "Gate Valve", "Ball Valve", "Globe Valve"
    size: { type: String, required: true },           // e.g. "150 mm", "6 Inch"
    pressureClass: { type: String, required: true },  // e.g. "300#", "Class 150"
    designStandard: { type: String, default: 'API 6D' },
    bodyMoc: { type: String, default: 'ASTM A216 WCB' },
    trimMoc: { type: String, default: 'SS 316 / 13% Cr' },
    endConnection: { type: String, default: 'Flanged RF' }
  },

  components: [bomComponentSchema],

  status: {
    type: String,
    enum: ['DRAFT_AI_SUGGESTED', 'PURCHASE_REVIEWED', 'CONFIRMED', 'PR_GENERATED'],
    default: 'DRAFT_AI_SUGGESTED',
    index: true
  },

  generatedPrs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseRequisition' }],

  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  confirmedAt: { type: Date },
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('BillOfMaterials', billOfMaterialsSchema);

const mongoose = require('mongoose');

const bomComponentSchema = new mongoose.Schema({
  itemNo: { type: Number, required: true },
  partName: { type: String, required: true },
  rawPartName: { type: String, default: '' }, // e.g. "BODY*•", "BALL/DISC/WEDGE*◊"
  
  // Official Petro Valves Engineering Classification Symbols
  isCritical: { type: Boolean, default: false },             // * TO BE CRITICAL PARTS
  isPressureContaining: { type: Boolean, default: false },   // • TO BE PRESSURE CONTAINING PARTS
  isPressureControlling: { type: Boolean, default: false },  // ◊ TO BE PRESSURE CONTROLLING PARTS
  
  drgNo: { type: String, default: '---' },                   // e.g. "BV02FBW04XTX450M001"
  revNo: { type: String, default: '00' },                    // e.g. "01", "02"
  remark: { type: String, default: '' },                     // e.g. "006-480460010", "M4216501"

  category: {
    type: String,
    enum: ['Raw Casting/Forging', 'Machined Trim', 'Fasteners', 'Gaskets & Seals', 'Hardware/Accessories', 'Other'],
    default: 'Machined Trim'
  },
  materialGrade: { type: String, default: '' },
  dimensions: { type: String, default: '' },
  bomMultiplier: { type: Number, default: 1 }, // per valve multiplier e.g. Body = 1, Seat Ring = 2, Studs = 24
  
  qtyPerValve: { type: Number, default: 1 },
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
  bomId: { type: String, unique: true, required: true, index: true }, // BOM-YYYY-MM-NNNN or BOM/BV02FBW04GTX450A000
  bomNumber: { type: String, default: '' },                           // e.g. "BOM/BV02FBW04GTX450A000"
  bomDate: { type: Date, default: Date.now },
  workOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder', required: true, index: true },
  quotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', index: true },
  drawing: { type: mongoose.Schema.Types.ObjectId, ref: 'Drawing', index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', index: true },
  itemIndex: { type: Number, default: 0 },

  // Official Petro Valves Design Specification Box
  designSpecs: {
    sizeClassEndDetail: { type: String, default: '' }, // e.g. "450MM 600# & BUTTWELD END"
    typeDesignOpt: { type: String, default: '' },      // e.g. "2 P/C TRUNNION MOUNTED BALL VALVE & G.BOX OPT."
    boreDetail: { type: String, default: 'FULL BORE' }, // e.g. "FULL BORE" / "REDUCED BORE"
    quantity: { type: String, default: '01 NOS' },     // e.g. "02 NOS"
    mfgStandard: { type: String, default: 'API 6D : 25th ED' },
    testingStandard: { type: String, default: 'API 6D : 25th ED' },
    weight: { type: String, default: '' },              // e.g. "APPROX. 2508 KG."
    drawingNo: { type: String, default: '' }
  },

  valveSpecs: {
    valveType: { type: String, required: true },      // e.g. "Trunnion Mounted Ball Valve", "Gate Valve"
    size: { type: String, required: true },           // e.g. "450 mm", "18 Inch"
    pressureClass: { type: String, required: true },  // e.g. "600#", "Class 600"
    designStandard: { type: String, default: 'API 6D' },
    bodyMoc: { type: String, default: 'ASTM A216 WCB' },
    trimMoc: { type: String, default: 'SS 316 / 13% Cr' },
    endConnection: { type: String, default: 'Butt weld' }
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
  notes: {
    type: String,
    default: 'NOTES:- * TO BE CRITICAL PARTS AND OTHERS ARE NON-CRITICAL PARTS.\n• TO BE PRESSURE CONTAINING PARTS.\n◊ TO BE PRESSURE CONTROLLING PARTS.'
  }
}, { timestamps: true });

module.exports = mongoose.model('BillOfMaterials', billOfMaterialsSchema);

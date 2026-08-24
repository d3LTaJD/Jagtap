const mongoose = require('mongoose');

const inventoryStockSchema = new mongoose.Schema({
  itemCode: { type: String, required: true, unique: true, index: true }, // e.g. "PART-WCB-BODY-150-300"
  partName: { type: String, required: true, index: true },                // e.g. "Body Casting", "Stem", "Spiral Gasket"
  category: {
    type: String,
    enum: ['Raw Casting/Forging', 'Machined Trim', 'Fasteners', 'Gaskets & Seals', 'Hardware/Accessories'],
    required: true,
    index: true
  },
  materialGrade: { type: String, required: true, index: true },          // e.g. "ASTM A216 WCB", "ASTM A182 F316"
  size: { type: String, default: '' },                                   // e.g. "150 mm", "6 Inch", "M24x180"
  pressureClass: { type: String, default: '' },                          // e.g. "300#", "Class 150"
  unit: { type: String, default: 'NOS' },

  // Stock quantities
  quantityOnHand: { type: Number, required: true, default: 0, min: 0 },
  quantityReserved: { type: Number, required: true, default: 0, min: 0 },
  quantityAvailable: { type: Number, required: true, default: 0, min: 0 }, // onHand - reserved

  reorderPoint: { type: Number, default: 5 },
  unitCost: { type: Number, default: 0 },
  location: { type: String, default: 'Central Warehouse - Bay A' },

  activeReservations: [
    {
      bomId: { type: mongoose.Schema.Types.ObjectId, ref: 'BillOfMaterials' },
      workOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder' },
      reservedQty: { type: Number, required: true },
      reservedAt: { type: Date, default: Date.now }
    }
  ]
}, { timestamps: true });

// Pre-save to ensure available = max(0, onHand - reserved)
inventoryStockSchema.pre('save', function(next) {
  this.quantityAvailable = Math.max(0, (this.quantityOnHand || 0) - (this.quantityReserved || 0));
  next();
});

// Atomic Transaction-Safe Stock Reservation Helper
inventoryStockSchema.statics.reserveStockAtomic = async function({ itemCode, partName, materialGrade, size, requiredQty, bomId, workOrderId }) {
  // Find matching stock item
  const query = itemCode ? { itemCode } : { partName, materialGrade, size: size || '' };
  
  // Find current stock
  const stockItem = await this.findOne(query);
  if (!stockItem || stockItem.quantityAvailable <= 0) {
    return {
      allocatedQty: 0,
      shortageQty: requiredQty,
      inStockQty: stockItem ? stockItem.quantityAvailable : 0
    };
  }

  const allocatable = Math.min(stockItem.quantityAvailable, requiredQty);
  
  // Atomic increment of reserved qty
  const updated = await this.findOneAndUpdate(
    { _id: stockItem._id, quantityAvailable: { $gte: allocatable } },
    {
      $inc: {
        quantityReserved: allocatable,
        quantityAvailable: -allocatable
      },
      $push: {
        activeReservations: {
          bomId,
          workOrderId,
          reservedQty: allocatable,
          reservedAt: new Date()
        }
      }
    },
    { new: true }
  );

  const actualAllocated = updated ? allocatable : 0;
  const shortage = Math.max(0, requiredQty - actualAllocated);

  return {
    allocatedQty: actualAllocated,
    shortageQty: shortage,
    inStockQty: updated ? updated.quantityAvailable : 0
  };
};

module.exports = mongoose.model('InventoryStock', inventoryStockSchema);

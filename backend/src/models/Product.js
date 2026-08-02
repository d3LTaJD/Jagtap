const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, unique: true, sparse: true }, // SKU or internal code
  
  category: { type: String }, // Can be tied to Master Data 'Product Category'
  type: { type: String },     // Can be tied to Master Data 'Product Type'
  
  description: { type: String },
  
  specifications: {
    material: String,
    standard: String,
    pressureClass: String,
    size: String,
    endConnection: String
  },
  
  unit: { type: String, trim: true, default: 'NOS' },
  basePrice: { type: Number },
  currency: { type: String, default: 'INR' },
  taxRate: { type: Number, default: 18 }, // Default GST percentage
  
  hsnCode: { type: String },
  weight: { type: Number }, // Standard weight in KG
  
  status: { type: String, enum: ['Active', 'Discontinued', 'In Development'], default: 'Active' },
  
  dynamicFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  notes: { type: String },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

productSchema.index({ name: 1 });
productSchema.index({ category: 1 });

module.exports = mongoose.model('Product', productSchema);

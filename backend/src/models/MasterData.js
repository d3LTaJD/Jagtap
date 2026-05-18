const mongoose = require('mongoose');

// A "Master Data Category" is a lookup table (e.g. "Material Types", "Welding Processes")
// Each category has multiple items (e.g. "SA-516 Gr. 70", "SA-240 TP 304")
const masterDataItemSchema = new mongoose.Schema({
  label: { type: String, required: true },
  value: { type: String, required: true },          // stored in records
  description: { type: String, default: '' },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { _id: true, timestamps: false });

const masterDataSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },  // e.g. "Material Types"
  slug: { type: String, required: true, unique: true },  // e.g. "material-types"
  description: { type: String, default: '' },
  icon: { type: String, default: '' },                    // optional icon name

  // The actual lookup items
  items: [masterDataItemSchema],

  // Link to a FieldDefinition if this master data powers a field's options
  linkedFields: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FieldDefinition' }],

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Auto-generate slug from name
masterDataSchema.pre('validate', function(next) {
  if (this.isModified('name') || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

module.exports = mongoose.model('MasterData', masterDataSchema);

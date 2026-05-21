const mongoose = require('mongoose');

const fieldDefinitionSchema = new mongoose.Schema({
  formContext: { type: String, required: true, enum: ['Enquiry', 'Product', 'Quotation', 'QAP'] },
  productCategory: { type: String },
  fieldName: { type: String, required: true },     // camelCase key — used for dynamicFields storage
  fieldLabel: { type: String, required: true },     // Human-readable label shown on form
  fieldType: {
    type: String,
    required: true,
    enum: [
      'Text (Short)', 'Text (Long)', 'Number', 'Dropdown (Single)',
      'Dropdown (Multi)', 'Date Picker', 'Date + Time', 'File Upload',
      'Checkbox (Boolean)', 'Radio Button', 'Lookup / Reference',
      'Signature', 'GPS Location', 'Auto-Calculated', 'Repeating Group',
      'Rich Text'
    ]
  },
  placeholder: { type: String }, // Hint text inside input
  isRequired: { type: Boolean, default: false },
  options: [mongoose.Schema.Types.Mixed],   // For Dropdown / Radio choices
  validationRules: {
    min: Number,
    max: Number,
    maxLength: Number,
    unitLabel: String            // e.g. 'kg', 'mm', 'MPa'
  },
  groupLabel: { type: String },  // For collapsible section grouping
  displayOrder: { type: Number, default: 0 },
  visibleToRoles: [{ type: String }],   // role strings e.g. ['SALES', 'DIRECTOR'] — empty = all
  editableByRoles: [{ type: String }],
  conditionalLogic: {
    dependsOnField: String,      // fieldName of the controlling field
    requiredValue: String        // value that must be present to show this field
  },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }     // soft-delete — hides on new forms, preserves history
}, { timestamps: true });

// Compound index: each fieldName must be unique per form context
fieldDefinitionSchema.index({ formContext: 1, fieldName: 1 }, { unique: true });

module.exports = mongoose.model('FieldDefinition', fieldDefinitionSchema);

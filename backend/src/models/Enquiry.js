const mongoose = require('mongoose');

const enquirySchema = new mongoose.Schema({
  enquiryId: { type: String, unique: true }, // ENQ-YYYY-MM-NNNN
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  sourceChannel: { type: String, required: true },
  emailAccount: { type: String, enum: ['info@', 'sales@', 'support@'] },
  indiaMartLeadId: { type: String },
  leadGenuineness: { type: String, enum: ['Genuine', 'Likely Genuine', 'Suspect', 'Junk'] },
  detailsSharedByLead: { type: Boolean, default: false },
  indiaMartContactMethod: { type: String, enum: ['Call', 'Message', 'Both'] },
  exhibitionName: { type: String },
  gemTenderNo: { type: String },

  contactPerson: { type: String, required: true },
  contactMobile: { type: String, required: true },
  contactEmail: { type: String },

  productCategory: { type: String, required: true }, // 'Pressure Vessel', 'Heat Exchanger', 'Storage Tank', 'Piping', 'Structural', 'Custom', 'Multiple'
  productDescription: { type: String, required: true, maxlength: 200 },
  quantity: { type: Number, required: true, default: 1 },
  unit: { type: String, enum: ['NOS', 'SET', 'MT', 'KG', 'M', 'M2', 'Job'], default: 'NOS' },

  requiredDeliveryWeeks: { type: Number },
  requiredDeliveryDate: { type: Date },
  budgetFrom: { type: Number },
  budgetTo: { type: Number },
  standardCode: { type: String, enum: ['ASME', 'IS', 'BS', 'EN', 'API', 'IBR', 'Custom', 'Not specified'] },
  thirdPartyInspection: { type: Boolean, default: false },
  specialRequirements: { type: String, maxlength: 400 },

  priority: { type: String, enum: ['Urgent', 'High', 'Medium', 'Low'], default: 'Medium' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  estimatedValue: { type: Number },

  status: {
    type: String,
    enum: ['New', 'Contacted', 'Technical Review', 'Ready for Offer', 'Quoted', 'Negotiating', 'Won', 'Lost', 'On Hold', 'Abandoned'],
    default: 'New'
  },
  lostReason: { type: String, enum: ['Price', 'Delivery', 'Competition', 'No Response', 'Spec Mismatch', 'Budget', 'Project Cancelled', 'Other'] },
  lostReasonDetail: { type: String, maxlength: 200 },
  winPoValue: { type: Number },

  // Mixed object to explicitly support the Dynamic Field configuration dictated by M0 Field Builder
  dynamicFields: { type: mongoose.Schema.Types.Mixed, default: {} },

  internalNotes: { type: String, maxlength: 300 },
  attachments: [{ type: String }], // Legacy URLs
  files: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FileMetadata' }], // New secure S3 files

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Follow-up Engine (denormalized for quick display)
  nextFollowUpDate: { type: Date, default: null },
  lastFollowUpAt: { type: Date, default: null },
}, { timestamps: true });

enquirySchema.index({ status: 1 });
enquirySchema.index({ assignedTo: 1 });

module.exports = mongoose.model('Enquiry', enquirySchema);

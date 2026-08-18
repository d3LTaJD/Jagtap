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

  // AI Classification Source Type
  sourceType: { 
    type: String, 
    enum: ['Direct Enquiry', 'Tender', 'Follow-up Reply', 'Manual Entry'], 
    default: 'Direct Enquiry' 
  },
  tenderNumber: { type: String },
  tenderDeadline: { type: Date },
  clientName: { type: String },         // End Client / Owner (extracted from PDF/tender)
  pmcConsultant: { type: String },       // PMC / EPCM / Project Management Consultant
  senderCompany: { type: String },       // Specific RFQ Sender Company (e.g. Sri Akshaya Engineering Pvt. Ltd.)

  contactPerson: { type: String, required: true },
  contactMobile: { type: String, required: true },
  contactEmail: { type: String },

  productCategory: { type: String, required: true }, // 'Pressure Vessel', 'Heat Exchanger', 'Storage Tank', 'Valves', 'Structural', 'Custom', 'Multiple'
  productDescription: { type: String, required: true, maxlength: 200 },
  quantity: { type: Number, required: true, default: 1 },
  unit: { type: String, trim: true, default: 'NOS' },

  requiredDeliveryWeeks: { type: Number },
  requiredDeliveryDate: { type: Date },
  budgetFrom: { type: Number },
  budgetTo: { type: Number },
  standardCode: { type: String, trim: true, default: 'Not specified' },
  thirdPartyInspection: { type: Boolean, default: false },
  specialRequirements: { type: String, maxlength: 400 },

  priority: { type: String, enum: ['Urgent', 'High', 'Medium', 'Low'], default: 'Medium' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  estimatedValue: { type: Number },

  status: {
    type: String,
    enum: ['New', 'Confirmed', 'Contacted', 'Technical Review', 'Ready for Offer', 'Quoted', 'Negotiating', 'Won', 'Lost', 'On Hold', 'Abandoned', 'Needs Review', 'Verified'],
    default: 'New'
  },
  lostReason: { type: String, enum: ['Price', 'Delivery', 'Competition', 'No Response', 'Spec Mismatch', 'Budget', 'Project Cancelled', 'Other'] },
  lostReasonDetail: { type: String, maxlength: 200 },
  winPoValue: { type: Number },

  // Verification and confidence metrics
  isUnverified: { type: Boolean, default: false },
  extractionConfidence: { type: Number }, // Final score
  aiConfidence: { type: Number },
  ocrConfidence: { type: Number },

  // Traceability tracking
  originalMessageId: { type: String, index: true },
  sourceEmailId: { type: String },
  threadId: { type: String, index: true },

  // Mixed object to explicitly support the Dynamic Field configuration dictated by M0 Field Builder
  dynamicFields: { type: mongoose.Schema.Types.Mixed, default: {} },

  products: [
    {
      lineItemId: { type: String },
      description: { type: String, default: '' },
      quantity: { type: Number, default: 1 },
      unit: {
        type: String,
        trim: true,
        default: 'NOS'
      },
      category: { type: String },
      standardCode: { type: String, trim: true, default: 'Not specified' },
      confidence: { type: Number },
      extractionStatus: {
        type: String,
        enum: ['raw', 'validated', 'approved', 'needs_review'],
        default: 'raw'
      },
      sourceSpecifications: { type: mongoose.Schema.Types.Mixed, default: {} },
      normalizedSpecifications: { type: mongoose.Schema.Types.Mixed, default: {} },
      masterData: { type: mongoose.Schema.Types.Mixed, default: {} },
      derivedSpecifications: { type: mongoose.Schema.Types.Mixed, default: {} },
      validation: { type: mongoose.Schema.Types.Mixed, default: { isValid: true, warnings: [], needsManualReview: false } },
      fieldConfidences: { type: mongoose.Schema.Types.Mixed, default: {} },
      dynamicFields: { type: mongoose.Schema.Types.Mixed, default: {} }
    }
  ],
  productSummary: { type: mongoose.Schema.Types.Mixed, default: {} },
  minConfidence: { type: Number },

  internalNotes: { type: String, maxlength: 300 },
  attachments: [{ type: String }], // Legacy URLs
  files: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FileMetadata' }], // Local storage files
  attachmentsList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Attachment' }], // Linked attachments (Granular & Versioned)

  // Review History Audit Log
  reviewHistory: [
    {
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      reviewedAt: { type: Date, default: Date.now },
      oldValues: { type: mongoose.Schema.Types.Mixed },
      newValues: { type: mongoose.Schema.Types.Mixed },
      reviewNotes: { type: String },
      confidenceBefore: { type: Number },
      confidenceAfter: { type: Number }
    }
  ],

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Follow-up Engine (denormalized for quick display)
  nextFollowUpDate: { type: Date, default: null },
  lastFollowUpAt: { type: Date, default: null },
  processingStatus: { type: String, enum: ['Pending', 'Processing', 'Completed', 'Failed'], default: 'Pending', index: true },
  processingMessage: { type: String },
  processingStartedAt: { type: Date },
  processingCompletedAt: { type: Date },
  // Comprehensive Tender Intelligence (populated for sourceType === 'Tender')
  tenderIntelligence: { type: mongoose.Schema.Types.Mixed, default: null },
  extractionMetadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

enquirySchema.pre('save', async function(next) {
  try {
    const FieldDefinition = mongoose.model('FieldDefinition');
    const fields = await FieldDefinition.find({ formContext: 'Enquiry', isDeleted: false, isActive: true });
    
    // Create a map of fieldName -> productCategory
    const fieldCatMap = {};
    for (const f of fields) {
      fieldCatMap[f.fieldName] = f.productCategory || '';
    }

    const cleanFields = (dynamicFields, targetCategory) => {
      if (!dynamicFields || typeof dynamicFields !== 'object') return {};
      if (!targetCategory || targetCategory === 'Multiple' || targetCategory === 'Custom') return dynamicFields;

      // Map common synonyms: e.g. "piping" -> "valves"
      const normalize = c => {
        const s = String(c).toLowerCase().replace(/[\s\/]+/g, '');
        if (s === 'valves' || s === 'piping' || s === 'pipingvalves') return 'valves';
        return s;
      };
      const normalizedTarget = normalize(targetCategory);

      // If target category is custom, general, tender, multiple, or unassigned, do not strip fields!
      if (['custom', 'multiple', 'general', 'tender'].includes(normalizedTarget)) {
        return dynamicFields;
      }

      const cleaned = {};
      for (const [key, val] of Object.entries(dynamicFields)) {
        const fieldCat = fieldCatMap[key];
        if (fieldCat) {
          const normalizedFieldCat = normalize(fieldCat);
          if (normalizedFieldCat !== normalizedTarget && normalizedFieldCat !== 'custom' && normalizedFieldCat !== 'multiple') {
            console.log(`[Schema-Aware Validation] Stripping field "${key}" (belongs to: "${fieldCat}") from category "${targetCategory}"`);
            continue;
          }
        }
        cleaned[key] = val;
      }
      return cleaned;
    };

    // Clean root dynamicFields
    if (this.dynamicFields) {
      this.dynamicFields = cleanFields(this.dynamicFields, this.productCategory);
    }

    // Clean each product's dynamicFields
    if (this.products && this.products.length > 0) {
      for (const prod of this.products) {
        if (prod.dynamicFields) {
          prod.dynamicFields = cleanFields(prod.dynamicFields, prod.category || this.productCategory);
        }
      }
    }

    next();
  } catch (err) {
    console.error('[Schema-Aware Validation] Error in Enquiry pre-save hook:', err.message);
    next(err);
  }
});

enquirySchema.index({ status: 1 });
enquirySchema.index({ assignedTo: 1 });

module.exports = mongoose.model('Enquiry', enquirySchema);

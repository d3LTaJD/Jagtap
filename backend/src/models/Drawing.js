const mongoose = require('mongoose');

const tdsChecklistItemSchema = new mongoose.Schema({
  code: { type: String, required: true },
  category: { type: String, required: true }, // 'Standard Conformance', 'Dimension Check', 'Material Match', 'Pressure/Hydro Rating', 'End Connection'
  checkName: { type: String, required: true },
  expectedValue: { type: String, default: '' },
  actualValue: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['PASS', 'FAIL', 'PENDING', 'NOT_APPLICABLE'], 
    default: 'PENDING' 
  },
  remarks: { type: String, default: '' }
}, { _id: false });

const drawingRevisionSchema = new mongoose.Schema({
  revisionNumber: { type: Number, required: true },
  revisionLabel: { type: String, required: true }, // "Rev 00", "Rev 01", "Rev 02"
  fileUrl: { type: String, required: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number, default: 0 },
  mimeType: { type: String, default: 'application/pdf' },
  storagePath: { type: String }, // Local storage key
  
  // AI Extracted Specifications & Provenance
  extractedParameters: {
    valveType: { type: mongoose.Schema.Types.Mixed },
    size: { type: mongoose.Schema.Types.Mixed },
    pressureClass: { type: mongoose.Schema.Types.Mixed },
    bodyMaterial: { type: mongoose.Schema.Types.Mixed },
    trimMaterial: { type: mongoose.Schema.Types.Mixed },
    faceToFace: { type: mongoose.Schema.Types.Mixed },
    endConnection: { type: mongoose.Schema.Types.Mixed },
    designStandard: { type: mongoose.Schema.Types.Mixed },
    drawingNumber: { type: mongoose.Schema.Types.Mixed },
    drawingRevision: { type: mongoose.Schema.Types.Mixed },
    rawExtraction: { type: mongoose.Schema.Types.Mixed, default: {} }
  },

  // TDS Technical Validation Checklist
  tdsChecklist: [tdsChecklistItemSchema],

  status: { 
    type: String, 
    enum: ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'REVISION_REQUESTED', 'REJECTED'], 
    default: 'UNDER_REVIEW' 
  },

  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  submittedAt: { type: Date, default: Date.now },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  comments: { type: String, default: '' },
  changesSummary: { type: String, default: '' }
}, { _id: false, timestamps: true });

const drawingSchema = new mongoose.Schema({
  drawingId: { type: String, unique: true, required: true, index: true }, // DWG-YYYY-MM-NNNN
  quotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', index: true },
  enquiry: { type: mongoose.Schema.Types.ObjectId, ref: 'Enquiry', index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },

  drawingNumber: { type: String, required: true, default: 'DWG-UNASSIGNED', index: true },
  drawingTitle: { type: String, required: true, default: 'General Arrangement Drawing' },
  
  drawingType: {
    type: String,
    enum: ['CUSTOMER_GA', 'INTERNAL_GA', 'CROSS_SECTION', 'P_AND_ID', 'VENDOR_COMPONENT', 'AS_BUILT'],
    default: 'INTERNAL_GA'
  },
  
  source: {
    type: String,
    enum: ['QUOTATION_AUTO', 'CUSTOMER_EMAIL', 'VENDOR_EXTERNAL', 'MANUAL_UPLOAD'],
    default: 'QUOTATION_AUTO'
  },

  // Requirements copied from Quotation
  requirements: {
    valveType: String,
    size: String,
    pressureClass: String,
    material: String,
    quantity: Number,
    designStandard: String,
    endConnection: String,
    operation: String,
    lineItems: [{ type: mongoose.Schema.Types.Mixed }]
  },

  // Third-Party Vendor SLA Tracking
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  vendorSlaDeadline: { type: Date },
  slaBreached: { type: Boolean, default: false, index: true },
  lastSlaFollowUpSentAt: { type: Date },

  // Director Delay Escalation
  isEscalated: { type: Boolean, default: false, index: true },
  escalatedAt: { type: Date },
  escalationReason: { type: String },
  directorNotified: { type: Boolean, default: false },

  // Lifecycle Status & Revision Management
  status: {
    type: String,
    enum: ['PENDING_UPLOAD', 'UNDER_REVIEW', 'APPROVED', 'REVISION_REQUESTED', 'REJECTED'],
    default: 'PENDING_UPLOAD',
    index: true
  },

  currentRevisionNumber: { type: Number, default: 0 },
  activeApprovedRevision: { type: drawingRevisionSchema, default: null }, // Frozen snapshot of the latest APPROVED revision
  revisions: [drawingRevisionSchema],

  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  targetCompletionDate: { type: Date },
  
  notes: { type: String, default: '' }
}, { timestamps: true });

// Auto-index for query performance
drawingSchema.index({ status: 1, slaBreached: 1, isEscalated: 1 });

module.exports = mongoose.model('Drawing', drawingSchema);

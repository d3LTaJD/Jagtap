const mongoose = require('mongoose');

const quotationItemSchema = new mongoose.Schema({
  itemNo: Number,
  description: String,
  productCategory: String,
  materialGrade: String,
  applicableStandard: String,
  quantity: Number,
  unit: String,
  unitPrice: { type: Number, default: 0 },
  testingCharges: { type: Number, default: 0 },
  inspectionCharges: { type: Number, default: 0 },
  ndtCharges: { type: Number, default: 0 },
  specialTestingCharges: { type: Number, default: 0 },
  sparesCharges: { type: Number, default: 0 },
  cert32Charges: { type: Number, default: 0 },
  pfCharges: { type: Number, default: 0 },
  tpiCharges: { type: Number, default: 0 },
  discountPercent: { type: Number, default: 0 },
  lineTotalExclGST: { type: Number, default: 0 },
  gstRate: { type: Number, default: 18 },
  gstAmount: { type: Number, default: 0 },
  lineTotalInclGST: { type: Number, default: 0 },
  testsRequired: [{ type: String }],
  manufacturingProcess: String,
  deliveryWeeks: Number,
  technicalDeviations: String,
  dynamicFields: { type: mongoose.Schema.Types.Mixed, default: {} }
});

const quotationSchema = new mongoose.Schema({
  quotationId: { type: String, unique: true }, // QT-YYYY-MM-NNNN
  costSummary: { type: mongoose.Schema.Types.Mixed },
  
  attachments: [{ type: String }],
  files: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FileMetadata' }],
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  enquiry: { type: mongoose.Schema.Types.ObjectId, ref: 'Enquiry', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  revisionNumber: { type: Number, default: 0 },
  revisionReason: String,
  
  status: { 
    type: String, 
    enum: ['DRAFT', 'TECH_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'Draft', 'Pending Technical Review', 'Pending Commercial Review', 'Sent', 'Accepted', 'Negotiating', 'Revised', 'Expired'],
    default: 'DRAFT'
  },

  preparedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  technicalReviewBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  scopeOfSupply: String,
  exclusions: String,
  deliverySchedule: String,
  pmcConsultant: String,
  currency: { type: String, default: 'INR' },
  
  items: [quotationItemSchema],

  // Technical Part-I parameters
  manufacturerName: { type: String, default: 'M/s. PETRO VALVES PVT LTD' },
  originOfGoods: { type: String, default: 'INDIA' },
  weightDimensions: { type: String, default: 'This details given at the time of dispatch' },
  technicalDocuments: { type: String, default: 'This is share after receiving of techno-commercial order' },
  deliveryTimeHeader: { type: String, default: 'Provided in COMMERCIAL PART - III' },

  // Commercial Part-III parameters
  priceBasis: { type: String, default: 'Ex Works Ahmedabad.' },
  packingForwardingTerms: { type: String, default: 'Extra as given in Price Part - II, If required in wooden box then charge extra' },
  freightTerms: { type: String, default: 'Extra at actual to your account.' },
  taxDutyTerms: { type: String, default: 'Extra at actual to your account (18% GST default)' },
  validityTerms: { type: String, default: 'Three Month from the date of Quote' },
  tpiTerms: { type: String, default: 'We will offer valves to your nominated TPIA agency. Charges towards TPIA fees will be to your account.' },
  transitInsurance: { type: String, default: 'In your scope only.' },
  guaranteeTerms: { type: String, default: '12 months from the date of commissioning or 18 months from the date of dispatch' },

  commercialTotals: {
    subtotalExclGST: Number,
    totalTestingCharges: Number,
    totalInspectionCharges: Number,
    freightCharges: Number,
    totalGST: Number,
    grandTotal: Number
  },

  paymentTerms: { type: String, default: '10% Advance along with PO & balance payment 90% against Proforma Invoice before dispatch.' },
  advancePercent: Number,
  specialCommercialNotes: String,
  dynamicFields: { type: mongoose.Schema.Types.Mixed, default: {} }, // Keep for compatibility
  
  validUntil: Date
}, { timestamps: true });

module.exports = mongoose.model('Quotation', quotationSchema);


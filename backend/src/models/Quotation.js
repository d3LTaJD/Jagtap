const mongoose = require('mongoose');

const quotationItemSchema = new mongoose.Schema({
  itemNo: Number,
  lineItemId: String,
  enquiryLineItemId: String,
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
  sourceSpecifications: { type: mongoose.Schema.Types.Mixed, default: {} },
  normalizedSpecifications: { type: mongoose.Schema.Types.Mixed, default: {} },
  masterData: { type: mongoose.Schema.Types.Mixed, default: {} },
  derivedSpecifications: { type: mongoose.Schema.Types.Mixed, default: {} },
  validation: { type: mongoose.Schema.Types.Mixed, default: { isValid: true, warnings: [], needsManualReview: false } },
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
  deliverySchedule: { type: String, default: '12 weeks as per certification from the date of approval of technical documents and advance payment.' },
  pmcConsultant: String,
  projectName: String,
  kindAttention: String,
  enquiryRefText: String,
  subjectText: { type: String, default: 'Offer for valves as per your requirements.' },
  salutationOpeningText: { type: String, default: 'Dear Sir, We acknowledge with thanks the receipt of your above referred enquiry and we are pleased to submit our proposal as under.' },
  technicalSpecificationClause: { type: String, default: 'We offered our valves as per Specification given in Contract Review Checklist.' },
  technicalDeviations: { type: String, default: 'No deviation / As per client specification' },
  currency: { type: String, default: 'INR' },
  
  items: [quotationItemSchema],

  // Technical Part-I parameters
  manufacturerName: { type: String, default: 'M/s. PETRO VALVES PVT LTD' },
  originOfGoods: { type: String, default: 'INDIA' },
  weightDimensions: { type: String, default: 'This details given at the time of dispatch' },
  technicalDocuments: { type: String, default: 'This is share after receiving of techno-commercial order' },
  deliveryTimeHeader: { type: String, default: 'Provided in COMMERCIAL PART - III' },

  // Price Part-II parameters
  pricePartNotice: { type: String, default: 'We offer our Valves as below, considering Contract Review Check (Format No. R/S.1.3.5/2 Rev04).' },
  ndtRequirementText: { type: String, default: 'Any NDT Requirement (i.e. RT, UT, MPT) then charges will be Extra at actual to your account.' },
  specialTestingRequirementText: { type: String, default: 'If any Special Testing Requirement (i.e. Helium, Nitrogen, Vacuum, IGC, PMI, NACE, Paint) then charges will be Extra at actual to your account.' },
  sparesMandayChargesText: { type: String, default: 'Spares, Manday required then charges will be Extra at actual to your account.' },
  cert32Terms: { type: String, default: 'Extra for 3.2 Certification Charges (5%)' },
  cert32Percent: { type: Number, default: 5 },
  pfTerms: { type: String, default: 'Extra for Packing & Forwarding Charges (5%)' },
  pfPercent: { type: Number, default: 5 },
  tpiaNoticeText: { type: String, default: 'Third Party Inspection (TPIA) required then charges will be Extra to your account.' },
  tpiCharges: { type: Number, default: 0 },
  gstRate: { type: Number, default: 18 },

  // Commercial Part-III parameters
  priceBasis: { type: String, default: 'Ex Works Ahmedabad.' },
  packingForwardingTerms: { type: String, default: 'Extra as given in Price Part - II, If required in wooden box packing & NIL for loose Plastic packing.' },
  freightTerms: { type: String, default: 'Extra at actual to your account.' },
  taxDutyTerms: { type: String, default: 'Extra at actual to your account (18% GST) as given in Price Part - II.' },
  paymentTerms: { type: String, default: '10% Advance along with PO & 20% with approved QAP & GAD Balance against Performa Invoice prior to dispatch.' },
  validityTerms: { type: String, default: 'Three Month from the date of Quote' },
  tpiTerms: { type: String, default: 'We will offer valves to your nominated TPIA, charges towards TPIA fees will be Extra at actual to your account as given in Price Part - II.' },
  certificationChargesTerms: { type: String, default: 'Extra as given in Price Part - II for 3.2 Certificates.' },
  transitInsurance: { type: String, default: 'In your scope only.' },
  guaranteeTerms: { type: String, default: '12 months from the date of commissioning or 18 months from the date of last shipment which ever is earlier.' },
  commercialNotes: { type: String, default: 'If RT, UT, PMI, IGC, NACE, Valves or Actuator Spares, Helium & Nitrogen tests required then charges will be extra at actual to your account as given in Price Part - II.\nIf API monogram required then price increase of 25% extra at actual.\nWe offer valves as per API-6D without any QSL requirements, if required in QSL-2 to 4b price increase upto 15% subject to QSL levels.' },
  cancellationTerms: { type: String, default: 'PO Cancellation or Modified (qty reduced) charges are as follows:\n• After order acknowledgement - 30%\n• After Manufacturing clearance - 50%\n• After receipt of Raw material - 100%' },
  jurisdictionTerms: { type: String, default: 'Subject to Ahmedabad Jurisdiction only.' },
  signatoryName: { type: String, default: 'Shubh Patel' },
  signatoryDesignation: { type: String, default: '(Marketing & Projects)' },
  signatoryPhone: { type: String, default: '9979713788' },

  commercialTotals: {
    subtotalExclGST: Number,
    totalTestingCharges: Number,
    totalInspectionCharges: Number,
    freightCharges: Number,
    cert32Amount: Number,
    pfAmount: Number,
    tpiAmount: Number,
    grandTotalBeforeGST: Number,
    totalGST: Number,
    grandTotal: Number
  },

  advancePercent: Number,
  specialCommercialNotes: String,
  dynamicFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  
  validUntil: Date
}, { timestamps: true });

module.exports = mongoose.model('Quotation', quotationSchema);


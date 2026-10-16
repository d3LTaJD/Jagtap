const mongoose = require('mongoose');

const inspectionActivitySchema = new mongoose.Schema({
  srNo: String,
  sectionNo: String,
  sectionTitle: String,
  component: String,
  typeOfCheck: String,
  quantumOfCheck: String,
  referenceDocument: String,
  acceptanceNorms: String,
  formatOfRecord: String,
  inHouseOutSource: { type: String, default: 'I' }, // 'I', 'O', 'I/O', 'Foundry'
  inspectionPvpl: { type: String, default: 'P' },   // 'P', 'P/H', 'R', 'W', 'H'
  inspectionTpi: { type: String, default: 'R' },    // 'R', 'W', 'H', '--'
  
  // Legacy & supplementary fields
  activityNo: Number,
  stageOfManufacture: String,
  activityName: String,
  acceptanceCriteria: String,
  inspectionAgency: String,
  tpiAgencyName: String,
  inspectionType: { type: String, default: 'R' }, 
  recordType: String,
  frequency: String,
  responsibleParty: String,
  status: { type: String, enum: ['Planned', 'In Progress', 'Completed', 'Waived', 'N/A'], default: 'Planned' },
  completionDate: Date,
  resultReference: String,
  remarks: String
});

const documentChecklistSchema = new mongoose.Schema({
  documentType: String,
  documentReferenceNo: String,
  status: { type: String, enum: ['Awaited', 'Received', 'Under Review', 'Accepted', 'Rejected'], default: 'Awaited' },
  receivedDate: Date,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  remarks: String
});

const qapSchema = new mongoose.Schema({
  qapId: { type: String, unique: true }, // QAP-YYYY-MM-NNNN
  qapNumber: { type: String },           // PV/QAP/PTISL/P2627041/BV/WCC
  revisionNo: { type: String, default: '00' },
  qapDate: { type: Date, default: Date.now },
  
  quotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' },
  workOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder' },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  revision: { type: Number, default: 0 },
  
  // Dynamic Header Fields
  endUser: { type: String, default: 'M/s. THINK GAS DISTRIBUTION PVT. LTD.' },
  clientName: { type: String },
  projectName: { type: String, default: 'THINK GAS (AG&P) PROJECT' },
  clientPoNo: { type: String },
  clientPoDate: { type: Date },

  // Dynamic Valve Details
  valveDetail: {
    valveType: { type: String, default: 'BALL VALVES' },
    designStandard: { type: String, default: 'API 6D 25TH ED.' },
    testingStandard: { type: String, default: 'API 6D 25TH ED.' },
    itemCode: { type: String, default: 'P262704101' },
    size: { type: String, default: '100MM' },
    pressureClass: { type: String, default: '300#' },
    endConnection: { type: String, default: 'BW' },
    bodyMoc: { type: String, default: 'ASTM A216 Gr.WCC' },
    trimMoc: { type: String, default: 'ASTM A351 Gr.CF8M' },
    stemMoc: { type: String, default: 'ASTM A479 Gr.410' },
    seatMoc: { type: String, default: 'ASTM A182 Gr.F6A' },
    fastenerMoc: { type: String, default: 'ASTM A193 Gr.B7 / ASTM A194 Gr.2H' },
    pupPieceMoc: { type: String, default: 'ASTM A106 Gr.B' },
    paintingDft: { type: String, default: '120 Micron' },
    notes: { type: String }
  },

  formatNo: { type: String, default: 'Format No.R/5.2/1  Rev01 Effective From 15-Sept-2022' },
  preparedByName: { type: String, default: 'QC Engg.' },
  approvedByName: { type: String, default: 'Incharge Q.C.' },
  
  status: { 
    type: String, 
    enum: ['GENERATED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'Draft', 'QC Review', 'Pending Director Approval', 'Sent to Client', 'Revised'],
    default: 'GENERATED' 
  },

  preparedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  directorSignatureUrl: String,

  activities: [inspectionActivitySchema],
  documents: [documentChecklistSchema],
  dynamicFields: { type: Map, of: mongoose.Schema.Types.Mixed },

  sentToClientDate: Date
}, { timestamps: true });

module.exports = mongoose.model('Qap', qapSchema);

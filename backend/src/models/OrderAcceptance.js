const mongoose = require('mongoose');

const orderAcceptanceItemSchema = new mongoose.Schema({
  itemNo: { type: Number, required: true },
  valveType: { type: String, default: 'Ball Valve' },
  designType: { type: String, default: '' },
  bore: { type: String, default: 'Full Bore' },
  endType: { type: String, default: 'Flanged RF' },
  operating: { type: String, default: 'Handwheel' },
  ballType: { type: String, default: '' },
  size: { type: String, default: '' },
  pressureClass: { type: String, default: '' },
  bodyMoc: { type: String, default: '' },
  trimMoc: { type: String, default: '' },
  quantity: { type: Number, required: true, default: 1 },
  unit: { type: String, default: 'NOS' },
  unitRate: { type: Number, required: true, default: 0 },
  totalAmount: { type: Number, required: true, default: 0 },
  tagNumber: { type: String, default: '' },
  remarks: { type: String, default: '' }
}, { _id: true });

const orderAcceptanceSchema = new mongoose.Schema({
  oaNumber: { type: String, unique: true, required: true, index: true }, // e.g. OA-2627039 / OA-2026-10-0039
  oaDate: { type: Date, default: Date.now },

  quotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', required: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  workOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder', index: true },
  proformaInvoice: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerProformaInvoice' },

  customerPoNumber: { type: String, required: true, index: true },
  customerPoDate: { type: Date, required: true },
  customerDeliveryDate: { type: Date, required: true }, // CDD

  tpiaScope: { type: String, enum: ['Self', 'Client', 'Third Party'], default: 'Self' },
  tpiaAgencyName: { type: String, default: '' },
  ldApplicable: { type: Boolean, default: false },
  ldClause: { type: String, default: 'No' },

  priceBasis: { type: String, default: 'Ex Works Ahmedabad' },
  packingForwarding: { type: String, default: '5% extra. If required in wooden box packing & NIL for loose Plastic packing.' },
  freight: { type: String, default: 'Extra at actual to your account.' },
  taxDuty: { type: String, default: 'Extra at actual to your account. (18% GST).' },
  termsOfPayment: { type: String, default: '10% Advance along with PO, Balance against Proforma Invoice / Dispatch.' },
  thirdPartyInspection: { type: String, default: '₹ 0 (Self inspection scope)' },
  deliveryTerms: { type: String, default: '4-6 Weeks from receipt of order & approved GAD/QAP.' },
  certification: { type: String, default: 'EN 10204 Type 3.1 Inspection Certificate' },
  guarantee: { type: String, default: '12 months from the date of commissioning or 18 months from the date of last shipment whichever is earlier.' },
  cancellationPolicy: { type: String, default: '• After order acknowledgement - 30% • After Manufacturing clearance - 50% • After receipt of Raw material - 100%' },
  jurisdiction: { type: String, default: 'Subject to Ahmedabad Jurisdiction only.' },

  items: [orderAcceptanceItemSchema],

  totalQuantity: { type: Number, default: 0 },
  subtotal: { type: Number, required: true, default: 0 },
  gstRate: { type: Number, default: 18 },
  gstAmount: { type: Number, default: 0 },
  grandTotal: { type: Number, required: true, default: 0 },

  status: {
    type: String,
    enum: ['DRAFT', 'ISSUED', 'ACCEPTED', 'CANCELLED'],
    default: 'ISSUED',
    index: true
  },

  preparedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  marketingIncharge: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('OrderAcceptance', orderAcceptanceSchema);

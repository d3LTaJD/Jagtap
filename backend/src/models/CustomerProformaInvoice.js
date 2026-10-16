const mongoose = require('mongoose');

const customerProformaInvoiceSchema = new mongoose.Schema({
  piNumber: { type: String, unique: true, required: true, index: true }, // e.g. PI-2627039 / CPI-2026-10-0039
  piDate: { type: Date, default: Date.now },

  quotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', required: true, index: true },
  orderAcceptance: { type: mongoose.Schema.Types.ObjectId, ref: 'OrderAcceptance', required: true, index: true },
  workOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder', index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },

  customerPoNumber: { type: String, required: true },
  customerPoDate: { type: Date, required: true },

  invoiceType: {
    type: String,
    enum: ['ADVANCE_10', 'INTERIM', 'BALANCE_90', 'FULL'],
    default: 'ADVANCE_10'
  },
  advancePercentage: { type: Number, default: 10 },

  totalOrderValue: { type: Number, required: true }, // Subtotal before GST
  advanceAmount: { type: Number, required: true },    // 10% of subtotal
  gstRate: { type: Number, default: 18 },
  gstAmount: { type: Number, required: true },        // 18% of advanceAmount
  grandTotal: { type: Number, required: true },       // advanceAmount + gstAmount

  amountInWords: { type: String, default: '' },

  bankDetails: {
    bankName: { type: String, default: 'HDFC BANK LTD' },
    accountName: { type: String, default: 'PETRO VALVES PVT. LTD.' },
    accountNumber: { type: String, default: '50200012345678' },
    ifscCode: { type: String, default: 'HDFC0000240' },
    branch: { type: String, default: 'KUHA, AHMEDABAD' }
  },

  paymentStatus: {
    type: String,
    enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID'],
    default: 'UNPAID',
    index: true
  },

  paidAmount: { type: Number, default: 0 },
  paymentDate: { type: Date },
  paymentReference: { type: String, default: '' }, // Bank UTR / Cheque / Transaction Number
  paymentReceiptUrl: { type: String, default: '' },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: { type: Date },

  notes: { type: String, default: '' },
  pdfPath: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('CustomerProformaInvoice', customerProformaInvoiceSchema);

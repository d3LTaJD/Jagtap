const mongoose = require('mongoose');
const User = require('../models/User');
const OrderAcceptance = require('../models/OrderAcceptance');
const CustomerProformaInvoice = require('../models/CustomerProformaInvoice');
const WorkOrder = require('../models/WorkOrder');
const Quotation = require('../models/Quotation');
const Customer = require('../models/Customer');
const { getNextSequenceValue } = require('../utils/counter');
const { logActivity } = require('../utils/logger');
const { notifyRoles } = require('../services/notificationService');
const { generateOrderAcceptancePdf } = require('../services/orderAcceptancePdfService');
const { generateCustomerProformaInvoicePdf } = require('../services/customerProformaInvoicePdfService');

/**
 * Step 1: Create Order Acceptance, 10% Advance PI, and Work Order from Customer PO
 */
exports.createOrderAcceptanceFromPo = async (req, res, next) => {
  try {
    const {
      quotationId,
      customerPoNumber,
      customerPoDate,
      customerDeliveryDate,
      tpiaScope = 'Self',
      tpiaAgencyName = '',
      ldApplicable = false,
      ldClause = 'No',
      termsOfPayment,
      priceBasis,
      packingForwarding,
      freight,
      items: customItems
    } = req.body;

    if (!quotationId || !customerPoNumber || !customerPoDate || !customerDeliveryDate) {
      return res.status(400).json({
        status: 'fail',
        message: 'Quotation ID, Customer PO Number, PO Date, and Customer Delivery Date (CDD) are required.'
      });
    }

    const quotation = await Quotation.findById(quotationId).populate('customer');
    if (!quotation) {
      return res.status(404).json({ status: 'fail', message: 'Quotation not found.' });
    }

    // Generate Sequential Identifiers with collision-free check
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `WO-${yearMonth}`;
    
    let workOrderId = '';
    let oaNumber = '';
    let piNumber = '';
    while (true) {
      const seq = await getNextSequenceValue(`ORDER-${yearMonth}`);
      const seqPadded = String(seq).padStart(4, '0');
      workOrderId = `${prefix}-${seqPadded}`;
      oaNumber = `OA-${yearMonth}-${seqPadded}`;
      piNumber = `PI-${yearMonth}-${seqPadded}`;
      const exists = await WorkOrder.findOne({ workOrderId });
      const oaExists = await OrderAcceptance.findOne({ oaNumber });
      if (!exists && !oaExists) break;
    }

    // Process line items
    const rawItems = (customItems && customItems.length > 0) ? customItems : (quotation.items || []);
    let calculatedSubtotal = 0;
    let totalQty = 0;

    const oaItems = rawItems.map((it, idx) => {
      const q = Number(it.quantity) || 1;
      const rate = Number(it.unitPrice || it.unitRate || it.finalUnitPrice || 0);
      const lineTotal = Number(it.lineTotalExclGST || it.totalAmount || (q * rate)) || 0;
      
      calculatedSubtotal += lineTotal;
      totalQty += q;

      return {
        itemNo: idx + 1,
        valveType: it.dynamicFields?.valve_type || it.productCategory || it.valveType || 'Ball Valve',
        designType: it.dynamicFields?.valve_design_type || it.designType || '2 p/c',
        bore: it.dynamicFields?.valve_bore || it.bore || 'Full Bore',
        endType: it.dynamicFields?.valve_end_connection || it.endConnection || it.endType || 'Flanged RF',
        operating: it.dynamicFields?.valve_operator || it.operating || 'Handwheel',
        ballType: it.dynamicFields?.valve_ball_type || it.ballType || '',
        size: it.dynamicFields?.valve_size || it.size || '',
        pressureClass: it.dynamicFields?.valve_class || it.pressureClass || '',
        bodyMoc: it.dynamicFields?.valve_body_moc || it.bodyMoc || '',
        trimMoc: it.dynamicFields?.valve_trim_moc || it.trimMoc || '',
        quantity: q,
        unit: it.unit || 'NOS',
        unitRate: rate,
        totalAmount: lineTotal,
        tagNumber: it.tagNumber || '',
        remarks: it.remarks || ''
      };
    });

    // If subtotal evaluated to 0, fallback to quotation total
    if (calculatedSubtotal === 0) {
      calculatedSubtotal = Number(
        quotation.commercialTotals?.subtotalExclGST ||
        quotation.commercialTotals?.grandTotalBeforeGST ||
        quotation.commercialTotals?.grandTotal ||
        quotation.subtotal ||
        0
      );
    }
    const gstRate = 18;
    const gstAmount = Math.round(calculatedSubtotal * (gstRate / 100));
    const grandTotal = calculatedSubtotal + gstAmount;

    // 10% Advance Calculations
    const advancePercentage = 10;
    const advanceAmount = Math.round(calculatedSubtotal * (advancePercentage / 100));
    const advanceGst = Math.round(advanceAmount * (gstRate / 100));
    const advanceGrandTotal = advanceAmount + advanceGst;

    // 1. Create Work Order in Stage 1
    const workOrder = await WorkOrder.create({
      workOrderId,
      quotation: quotation._id,
      customer: quotation.customer?._id || quotation.customer,
      customerPoNumber,
      customerPoDate: new Date(customerPoDate),
      customerDeliveryDate: new Date(customerDeliveryDate),
      stage: 'STAGE_1_PO_RECEIVED',
      status: 'AWAITING_ADVANCE_PAYMENT',
      isAdvanceReceived: false,
      isDrawingApproved: false,
      isQapApproved: false,
      items: oaItems.map(it => ({
        itemNo: it.itemNo,
        description: `${it.size} ${it.pressureClass} ${it.valveType} (${it.bodyMoc || 'WCB'})`,
        size: it.size,
        pressureClass: it.pressureClass,
        valveType: it.valveType,
        materialGrade: it.bodyMoc,
        endConnection: it.endType,
        quantity: it.quantity,
        unit: it.unit,
        tagNumber: it.tagNumber,
        unitRate: it.unitRate,
        totalAmount: it.totalAmount
      })),
      targetDeliveryDate: new Date(customerDeliveryDate)
    });

    // 2. Create Order Acceptance
    const orderAcceptance = await OrderAcceptance.create({
      oaNumber,
      oaDate: now,
      quotation: quotation._id,
      customer: quotation.customer?._id || quotation.customer,
      workOrder: workOrder._id,
      customerPoNumber,
      customerPoDate: new Date(customerPoDate),
      customerDeliveryDate: new Date(customerDeliveryDate),
      tpiaScope,
      tpiaAgencyName,
      ldApplicable,
      ldClause: ldApplicable ? 'Yes' : 'No',
      termsOfPayment: termsOfPayment || '10% Advance along with PO, Balance against Proforma Invoice / Dispatch.',
      priceBasis: priceBasis || 'Ex Works Ahmedabad',
      packingForwarding: packingForwarding || '5% extra. If required in wooden box packing & NIL for loose Plastic packing.',
      freight: freight || 'Extra at actual to your account.',
      items: oaItems,
      totalQuantity: totalQty,
      subtotal: calculatedSubtotal,
      gstRate,
      gstAmount,
      grandTotal,
      preparedBy: req.user?._id,
      status: 'ISSUED'
    });

    // 3. Create Customer Proforma Invoice for 10% Advance
    const customerProformaInvoice = await CustomerProformaInvoice.create({
      piNumber,
      piDate: now,
      quotation: quotation._id,
      orderAcceptance: orderAcceptance._id,
      workOrder: workOrder._id,
      customer: quotation.customer?._id || quotation.customer,
      customerPoNumber,
      customerPoDate: new Date(customerPoDate),
      invoiceType: 'ADVANCE_10',
      advancePercentage,
      totalOrderValue: calculatedSubtotal,
      advanceAmount,
      gstRate,
      gstAmount: advanceGst,
      grandTotal: advanceGrandTotal,
      paymentStatus: 'UNPAID'
    });

    // 4. Update cross-references
    workOrder.orderAcceptance = orderAcceptance._id;
    workOrder.customerProformaInvoice = customerProformaInvoice._id;
    await workOrder.save();

    orderAcceptance.proformaInvoice = customerProformaInvoice._id;
    await orderAcceptance.save();

    // 5. Update Quotation status
    quotation.status = 'ACCEPTED';
    await quotation.save();

    // 6. Notifications & Logs
    await notifyRoles({
      roles: ['SALES', 'SA', 'DIR', 'MGR'],
      type: 'WORK_ORDER_CREATED',
      title: `🎉 Order Booked: ${oaNumber}`,
      message: `Customer PO #${customerPoNumber} received! Order Acceptance ${oaNumber} & 10% Advance PI ${piNumber} generated.`,
      related_id: workOrder._id
    });

    if (typeof req.get === 'function') {
      await logActivity({
        req,
        action: 'CREATE',
        module: 'OrderAcceptance',
        resourceId: orderAcceptance._id,
        resourceName: oaNumber,
        details: `Order Acceptance ${oaNumber} and 10% PI ${piNumber} generated against PO #${customerPoNumber}`
      });
    }

    res.status(201).json({
      status: 'success',
      message: 'Order Acceptance, 10% Advance Proforma Invoice, and Work Order created successfully!',
      data: {
        orderAcceptance,
        proformaInvoice: customerProformaInvoice,
        workOrder
      }
    });

  } catch (err) {
    next(err);
  }
};

/**
 * List all Order Acceptances
 */
exports.getOrderAcceptances = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const query = {};

    if (search) {
      const reg = new RegExp(search, 'i');
      query.$or = [{ oaNumber: reg }, { customerPoNumber: reg }];
    }

    const total = await OrderAcceptance.countDocuments(query);
    const orderAcceptances = await OrderAcceptance.find(query)
      .populate('customer', 'companyName primaryContactName emailAddress customerId')
      .populate('quotation', 'quotationId grandTotal status')
      .populate('workOrder', 'workOrderId stage status isAdvanceReceived isDrawingApproved isQapApproved')
      .populate('proformaInvoice', 'piNumber paymentStatus grandTotal')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      status: 'success',
      total,
      data: { orderAcceptances }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get single Order Acceptance
 */
exports.getOrderAcceptance = async (req, res, next) => {
  try {
    const orderAcceptance = await OrderAcceptance.findById(req.params.id)
      .populate('customer')
      .populate('quotation')
      .populate('workOrder')
      .populate('proformaInvoice')
      .populate('preparedBy', 'fullName email');

    if (!orderAcceptance) {
      return res.status(404).json({ status: 'fail', message: 'Order Acceptance not found.' });
    }

    res.status(200).json({
      status: 'success',
      data: { orderAcceptance }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Download Order Acceptance PDF
 */
exports.downloadOrderAcceptancePdf = async (req, res, next) => {
  try {
    const rawId = req.params.id;
    let orderAcceptance = null;

    if (mongoose.Types.ObjectId.isValid(rawId)) {
      orderAcceptance = await OrderAcceptance.findById(rawId)
        .populate('customer')
        .populate('workOrder')
        .populate('preparedBy', 'fullName');

      if (!orderAcceptance) {
        orderAcceptance = await OrderAcceptance.findOne({ workOrder: rawId })
          .populate('customer')
          .populate('workOrder')
          .populate('preparedBy', 'fullName');
      }
    }

    if (!orderAcceptance) {
      orderAcceptance = await OrderAcceptance.findOne({ oaNumber: rawId })
        .populate('customer')
        .populate('workOrder')
        .populate('preparedBy', 'fullName');
    }

    if (!orderAcceptance) {
      return res.status(404).json({ status: 'fail', message: 'Order Acceptance not found.' });
    }

    const pdfBuffer = await generateOrderAcceptancePdf(orderAcceptance);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${orderAcceptance.oaNumber || 'Order_Acceptance'}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

/**
 * Download Customer Proforma Invoice PDF (10% Advance)
 */
exports.downloadCustomerPiPdf = async (req, res, next) => {
  try {
    const rawId = req.params.id;
    let pi = null;

    if (mongoose.Types.ObjectId.isValid(rawId)) {
      pi = await CustomerProformaInvoice.findById(rawId)
        .populate('customer')
        .populate('orderAcceptance')
        .populate('workOrder');

      if (!pi) {
        pi = await CustomerProformaInvoice.findOne({ workOrder: rawId })
          .populate('customer')
          .populate('orderAcceptance')
          .populate('workOrder');
      }

      if (!pi) {
        pi = await CustomerProformaInvoice.findOne({ orderAcceptance: rawId })
          .populate('customer')
          .populate('orderAcceptance')
          .populate('workOrder');
      }
    }

    if (!pi) {
      pi = await CustomerProformaInvoice.findOne({ piNumber: rawId })
        .populate('customer')
        .populate('orderAcceptance')
        .populate('workOrder');
    }

    if (!pi) {
      return res.status(404).json({ status: 'fail', message: 'Proforma Invoice not found.' });
    }

    const pdfBuffer = await generateCustomerProformaInvoicePdf(pi);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pi.piNumber || 'Proforma_Invoice'}_10_Percent_Advance.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

/**
 * Step 2: Record 10% Advance Payment Receipt (Unlocks Stage 2 & Technical Submittals)
 */
exports.recordAdvancePayment = async (req, res, next) => {
  try {
    const {
      proformaInvoiceId,
      amount,
      paymentDate = new Date(),
      paymentReference, // Bank UTR No.
      bankName = '',
      notes = ''
    } = req.body;

    if (!proformaInvoiceId || !paymentReference) {
      return res.status(400).json({
        status: 'fail',
        message: 'Proforma Invoice ID and Payment UTR Reference are required.'
      });
    }

    const pi = await CustomerProformaInvoice.findById(proformaInvoiceId)
      .populate('workOrder')
      .populate('orderAcceptance')
      .populate('customer');

    if (!pi) {
      return res.status(404).json({ status: 'fail', message: 'Proforma Invoice not found.' });
    }

    const receivedAmt = Number(amount) || pi.grandTotal;

    // 1. Mark Proforma Invoice as PAID
    pi.paymentStatus = 'PAID';
    pi.paidAmount = receivedAmt;
    pi.paymentDate = new Date(paymentDate);
    pi.paymentReference = paymentReference;
    pi.notes = notes;
    pi.verifiedBy = req.user?._id;
    pi.verifiedAt = new Date();
    await pi.save();

    // 2. Clear Advance Gate on Work Order and transition to STAGE_2_ADVANCE_RECEIVED
    let workOrder = null;
    if (pi.workOrder) {
      workOrder = await WorkOrder.findById(pi.workOrder._id || pi.workOrder);
      if (workOrder) {
        workOrder.isAdvanceReceived = true;
        workOrder.advanceReceivedAmount = receivedAmt;
        workOrder.advanceReceivedAt = new Date(paymentDate);
        workOrder.advancePaymentRef = paymentReference;
        workOrder.stage = 'STAGE_2_ADVANCE_RECEIVED';
        workOrder.status = 'AWAITING_GAD_QAP_APPROVAL';
        await workOrder.save();
      }
    }

    // 3. Notification to Engineering / Quality / Sales
    await notifyRoles({
      roles: ['SA', 'DIR', 'QA', 'QC', 'MGR', 'SALES'],
      type: 'PAYMENT_RECEIVED',
      title: `💰 10% Advance Received (${paymentReference})`,
      message: `10% Advance payment of ₹${receivedAmt.toLocaleString('en-IN')} verified for ${pi.piNumber} (WO: ${workOrder?.workOrderId || '-'}). GAD & QAP submittal unlocked!`,
      related_id: workOrder?._id || pi._id
    });

    if (typeof req.get === 'function') {
      await logActivity({
        req,
        action: 'UPDATE',
        module: 'CustomerProformaInvoice',
        resourceId: pi._id,
        resourceName: pi.piNumber,
        details: `10% Advance payment of ₹${receivedAmt} recorded with UTR ${paymentReference}`
      });
    }

    res.status(200).json({
      status: 'success',
      message: '10% Advance Payment recorded and verified! Work Order progressed to Stage 2 (Awaiting GAD & QAP Approval).',
      data: {
        proformaInvoice: pi,
        workOrder
      }
    });

  } catch (err) {
    next(err);
  }
};

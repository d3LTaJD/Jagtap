const WorkOrder = require('../models/WorkOrder');
const Quotation = require('../models/Quotation');
const Drawing = require('../models/Drawing');
const Customer = require('../models/Customer');
const User = require('../models/User');
const Enquiry = require('../models/Enquiry');
const tdsService = require('../services/tdsService');
const { getNextSequenceValue } = require('../utils/counter');
const { logActivity } = require('../utils/logger');

/**
 * List all Work Orders
 */
exports.getWorkOrders = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;

    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { workOrderId: regex }
      ];
    }

    const total = await WorkOrder.countDocuments(query);
    const workOrders = await WorkOrder.find(query)
      .populate('customer', 'companyName primaryContactName emailAddress customerId')
      .populate('quotation', 'quotationId grandTotal status')
      .populate('drawing', 'drawingId drawingNumber drawingTitle status activeApprovedRevision')
      .populate('releasedBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      status: 'success',
      total,
      data: { workOrders }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get single Work Order
 */
exports.getWorkOrder = async (req, res, next) => {
  try {
    const workOrder = await WorkOrder.findById(req.params.id)
      .populate('customer')
      .populate('quotation')
      .populate('drawing')
      .populate('releasedBy', 'name email role');

    if (!workOrder) {
      return res.status(404).json({ status: 'fail', message: 'Work Order not found' });
    }

    res.status(200).json({
      status: 'success',
      data: { workOrder }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new Work Order
 */
exports.createWorkOrder = async (req, res, next) => {
  try {
    const { 
      quotationId, 
      customerId, 
      drawingId, 
      selectedRevisionNumber,
      items = [], 
      targetDeliveryDate, 
      productionNotes 
    } = req.body;

    const quotation = await Quotation.findById(quotationId);
    if (!quotation) {
      return res.status(400).json({ status: 'fail', message: 'Valid Quotation is required.' });
    }

    let drawing = null;
    if (drawingId) {
      drawing = await Drawing.findById(drawingId);
    } else {
      drawing = await Drawing.findOne({ quotation: quotation._id });
    }

    if (!drawing) {
      return res.status(400).json({ status: 'fail', message: 'Drawing must be created before a Work Order can be drafted.' });
    }

    const now = new Date();
    const prefix = `WO-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const seq = await getNextSequenceValue(prefix);
    const workOrderId = `${prefix}-${String(seq).padStart(4, '0')}`;

    const workOrderItems = items.length > 0 ? items : (quotation.items || []).map((it, idx) => ({
      itemNo: idx + 1,
      description: it.description,
      size: it.dynamicFields?.valve_size || it.size || '',
      pressureClass: it.dynamicFields?.valve_class || it.pressureClass || '',
      valveType: it.dynamicFields?.valve_type || it.productCategory || '',
      materialGrade: it.dynamicFields?.valve_body_moc || it.materialGrade || '',
      endConnection: it.dynamicFields?.valve_end_connection || 'Flanged RF',
      quantity: it.quantity || 1,
      unit: it.unit || 'NOS'
    }));

    // Check specific revision if requested
    let targetRev = null;
    if (selectedRevisionNumber !== undefined && selectedRevisionNumber !== null && selectedRevisionNumber !== '') {
      targetRev = drawing.revisions?.find(r => r.revisionNumber === Number(selectedRevisionNumber));
    }
    if (!targetRev) {
      targetRev = drawing.activeApprovedRevision || drawing.revisions?.[drawing.revisions.length - 1] || null;
    }

    const targetRevNo = targetRev ? targetRev.revisionNumber : 0;
    const targetRevLabel = targetRev ? targetRev.revisionLabel : 'Rev 00';

    // A revision is only approved if drawing is APPROVED AND activeApprovedRevision matches this revision
    const isApproved = drawing.status === 'APPROVED' && 
      Boolean(drawing.activeApprovedRevision) && 
      drawing.activeApprovedRevision.revisionNumber === targetRevNo;

    const workOrder = await WorkOrder.create({
      workOrderId,
      quotation: quotation._id,
      customer: customerId || quotation.customer,
      drawing: drawing._id,
      status: isApproved ? 'DRAFT' : 'PENDING_DRAWING_APPROVAL',
      isDrawingApproved: isApproved,
      selectedRevisionNumber: targetRevNo,
      approvedDrawingRevision: isApproved ? targetRevNo : undefined,
      approvedDrawingLabel: targetRevLabel,
      items: workOrderItems,
      targetDeliveryDate: targetDeliveryDate ? new Date(targetDeliveryDate) : undefined,
      productionNotes: productionNotes || ''
    });

    const populatedWo = await WorkOrder.findById(workOrder._id)
      .populate('customer', 'companyName primaryContactName emailAddress customerId')
      .populate('quotation', 'quotationId grandTotal status')
      .populate('drawing', 'drawingId drawingNumber drawingTitle status activeApprovedRevision revisions')
      .populate('releasedBy', 'name email role');

    if (typeof req.get === 'function') {
      await logActivity({
        req,
        action: 'CREATE',
        module: 'WorkOrder',
        resourceId: workOrder._id,
        resourceName: workOrder.workOrderId,
        details: `Work Order drafted: ${workOrder.workOrderId} (Linked Drawing: ${drawing.drawingId} ${targetRevLabel})`
      });
    }

    res.status(201).json({
      status: 'success',
      message: 'Work Order created successfully.',
      data: { workOrder: populatedWo }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Release Work Order to Production (HARD AUTHORITATIVE BACKEND GATE)
 * Returns 403 Forbidden with zero override if Drawing is not APPROVED.
 */
exports.releaseWorkOrder = async (req, res, next) => {
  try {
    const { releaseNotes = '' } = req.body;

    const workOrder = await tdsService.enforceWorkOrderReleaseGate({
      workOrderId: req.params.id,
      user: req.user,
      releaseNotes
    });

    if (typeof req.get === 'function') {
      await logActivity({
        req,
        action: 'RELEASE',
        module: 'WorkOrder',
        resourceId: workOrder._id,
        resourceName: workOrder.workOrderId,
        details: `Work Order ${workOrder.workOrderId} released with approved drawing revision ${workOrder.approvedDrawingLabel}`
      });
    }

    res.status(200).json({
      status: 'success',
      message: `Work Order ${workOrder.workOrderId} successfully RELEASED to production using approved drawing revision (${workOrder.approvedDrawingLabel})!`,
      data: { workOrder }
    });
  } catch (err) {
    if (err.statusCode === 403) {
      return res.status(403).json({
        status: 'fail',
        gateBlocked: true,
        message: err.message
      });
    }
    next(err);
  }
};

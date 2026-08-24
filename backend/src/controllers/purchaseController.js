const PurchaseOrder = require('../models/PurchaseOrder');
const PurchaseRequisition = require('../models/PurchaseRequisition');
const BillOfMaterials = require('../models/BillOfMaterials');
const WorkOrder = require('../models/WorkOrder');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const purchaseOrderService = require('../services/purchaseOrderService');
const { logActivity } = require('../utils/logger');

/**
 * List all Purchase Requisitions (PRs)
 */
exports.getRequisitions = async (req, res, next) => {
  try {
    const { status, category, bomId, page = 1, limit = 50 } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }
    if (category && category !== 'all') {
      query.category = category;
    }
    if (bomId) {
      query.bom = bomId;
    }

    const total = await PurchaseRequisition.countDocuments(query);
    const requisitions = await PurchaseRequisition.find(query)
      .populate('bom', 'bomId valveSpecs status')
      .populate('workOrder', 'workOrderId status targetDeliveryDate')
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      status: 'success',
      total,
      data: { requisitions }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * List all Purchase Orders (POs) with HIT Numbers & CPD Status
 */
exports.getPurchaseOrders = async (req, res, next) => {
  try {
    const { status, vendorId, isRisk, search, page = 1, limit = 50 } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }
    if (vendorId) {
      query.vendor = vendorId;
    }
    if (isRisk === 'true') {
      query.isCpdRisk = true;
    }
    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { poId: regex },
        { hitNumber: regex },
        { 'items.description': regex }
      ];
    }

    const total = await PurchaseOrder.countDocuments(query);
    const purchaseOrders = await PurchaseOrder.find(query)
      .populate('vendor', 'name email mobile gstin vendorType')
      .populate('workOrder', 'workOrderId status targetDeliveryDate')
      .populate('bom', 'bomId valveSpecs')
      .populate('proformaInvoice', 'piId piNumber reconciliationStatus isCleanMatch')
      .populate('issuedBy', 'name email role')
      .sort({ poDate: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      status: 'success',
      total,
      data: { purchaseOrders }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get single Purchase Order detail
 */
exports.getPurchaseOrder = async (req, res, next) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id)
      .populate('vendor')
      .populate('workOrder')
      .populate('bom')
      .populate('requisitions')
      .populate('proformaInvoice')
      .populate('issuedBy', 'name email role');

    if (!po) {
      return res.status(404).json({ status: 'fail', message: 'Purchase Order not found' });
    }

    res.status(200).json({
      status: 'success',
      data: { purchaseOrder: po }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Issue Purchase Order from PRs (Strict HIT-YYYY-NNNN format)
 */
exports.createPurchaseOrder = async (req, res, next) => {
  try {
    const {
      vendorId,
      prIds,
      customItems,
      expectedDeliveryDate,
      cpdDate,
      vendorLeadTimeDays,
      qcInspectionDays,
      machiningBufferDays,
      notes
    } = req.body;

    const po = await purchaseOrderService.createPurchaseOrderFromPrs({
      vendorId,
      prIds,
      customItems,
      expectedDeliveryDate,
      cpdDate,
      vendorLeadTimeDays,
      qcInspectionDays,
      machiningBufferDays,
      user: req.user,
      notes
    });

    if (typeof req.get === 'function') {
      await logActivity({
        req,
        action: 'CREATE_PO',
        module: 'Purchase',
        resourceId: po._id,
        resourceName: po.poId,
        details: `Purchase Order ${po.poId} issued (HIT Number: ${po.hitNumber})`
      });
    }

    res.status(201).json({
      status: 'success',
      message: `Purchase Order ${po.poId} issued successfully with HIT Number ${po.hitNumber}.`,
      data: { purchaseOrder: po }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get CPD Procurement Risk Matrix
 */
exports.getCpdRiskMatrix = async (req, res, next) => {
  try {
    const pos = await PurchaseOrder.find({
      status: { $in: ['ISSUED_TO_VENDOR', 'DRAFT', 'PI_RECEIVED'] }
    })
      .populate('vendor', 'name mobile')
      .populate('workOrder', 'workOrderId targetDeliveryDate')
      .sort({ latestProcurementStartDate: 1 });

    const now = new Date();
    const matrix = pos.map(po => {
      const vLead = po.vendorLeadTimeDays || 15;
      const qcDays = po.qcInspectionDays || 3;
      const mBuffer = po.machiningBufferDays || 5;
      const totalLead = vLead + qcDays + mBuffer;

      const cpd = po.cpdDate || po.workOrder?.targetDeliveryDate || new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
      const latestStart = new Date(new Date(cpd).getTime() - totalLead * 24 * 60 * 60 * 1000);
      const daysUntilRisk = Math.ceil((latestStart.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

      return {
        poId: po.poId,
        hitNumber: po.hitNumber,
        vendorName: po.vendor?.name || 'Supplier',
        workOrderId: po.workOrder?.workOrderId || 'N/A',
        grandTotal: po.grandTotal,
        cpdDate: cpd,
        leadTimeBreakdown: {
          vendorLeadTimeDays: vLead,
          qcInspectionDays: qcDays,
          machiningBufferDays: mBuffer,
          totalProcurementLeadDays: totalLead
        },
        latestProcurementStartDate: latestStart,
        daysUntilRisk,
        isOverdue: daysUntilRisk <= 0,
        riskLevel: daysUntilRisk <= 0 ? 'CRITICAL_RISK' : (daysUntilRisk <= 3 ? 'MODERATE_RISK' : 'ON_TRACK'),
        status: po.status
      };
    });

    res.status(200).json({
      status: 'success',
      totalActive: matrix.length,
      criticalCount: matrix.filter(m => m.riskLevel === 'CRITICAL_RISK').length,
      moderateCount: matrix.filter(m => m.riskLevel === 'MODERATE_RISK').length,
      data: { matrix }
    });
  } catch (err) {
    next(err);
  }
};

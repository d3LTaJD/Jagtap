const BillOfMaterials = require('../models/BillOfMaterials');
const WorkOrder = require('../models/WorkOrder');
const Quotation = require('../models/Quotation');
const Customer = require('../models/Customer');
const Drawing = require('../models/Drawing');
const PurchaseRequisition = require('../models/PurchaseRequisition');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const aiBomService = require('../services/aiBomService');
const { logActivity } = require('../utils/logger');

/**
 * List all Bills of Materials
 */
exports.getBoms = async (req, res, next) => {
  try {
    const { status, workOrderId, search, page = 1, limit = 50 } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }
    if (workOrderId) {
      query.workOrder = workOrderId;
    }
    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { bomId: regex },
        { 'valveSpecs.valveType': regex },
        { 'valveSpecs.size': regex }
      ];
    }

    const total = await BillOfMaterials.countDocuments(query);
    const boms = await BillOfMaterials.find(query)
      .populate('workOrder', 'workOrderId status targetDeliveryDate')
      .populate('customer', 'companyName customerId')
      .populate('quotation', 'quotationId grandTotal')
      .populate('drawing', 'drawingId drawingNumber status')
      .populate('confirmedBy', 'name email role')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      status: 'success',
      total,
      data: { boms }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get single BOM detail
 */
exports.getBom = async (req, res, next) => {
  try {
    const bom = await BillOfMaterials.findById(req.params.id)
      .populate('workOrder')
      .populate('customer')
      .populate('quotation')
      .populate('drawing')
      .populate('generatedPrs')
      .populate('confirmedBy', 'name email role');

    if (!bom) {
      return res.status(404).json({ status: 'fail', message: 'Bill of Materials not found' });
    }

    res.status(200).json({
      status: 'success',
      data: { bom }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Auto-generate BOM from Work Order
 */
exports.generateBomForWorkOrder = async (req, res, next) => {
  try {
    const { workOrderId } = req.params;
    const bom = await aiBomService.generateAiBomForWorkOrder({
      workOrderId,
      user: req.user
    });

    if (typeof req.get === 'function') {
      await logActivity({
        req,
        action: 'GENERATE_BOM',
        module: 'BOM',
        resourceId: bom._id,
        resourceName: bom.bomId,
        details: `AI BOM generated: ${bom.bomId} for Work Order ${workOrderId}`
      });
    }

    res.status(201).json({
      status: 'success',
      message: `Bill of Materials ${bom.bomId} generated successfully.`,
      data: { bom }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update / Adjust BOM components
 */
exports.updateBom = async (req, res, next) => {
  try {
    const { components, notes } = req.body;
    const bom = await BillOfMaterials.findById(req.params.id);
    if (!bom) {
      return res.status(404).json({ status: 'fail', message: 'BOM not found' });
    }

    if (components && Array.isArray(components)) {
      bom.components = components;
      bom.status = 'PURCHASE_REVIEWED';
    }
    if (notes !== undefined) {
      bom.notes = notes;
    }

    await bom.save();

    res.status(200).json({
      status: 'success',
      message: 'BOM updated successfully.',
      data: { bom }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Confirm BOM & Auto-Generate PRs
 */
exports.confirmBom = async (req, res, next) => {
  try {
    const { adjustments } = req.body;
    const result = await aiBomService.confirmBomAndGeneratePrs({
      bomId: req.params.id,
      user: req.user,
      adjustments
    });

    if (typeof req.get === 'function') {
      await logActivity({
        req,
        action: 'CONFIRM_BOM',
        module: 'BOM',
        resourceId: result.bom._id,
        resourceName: result.bom.bomId,
        details: `BOM ${result.bom.bomId} confirmed. Generated ${result.prs.length} Purchase Requisitions.`
      });
    }

    res.status(200).json({
      status: 'success',
      message: `BOM ${result.bom.bomId} confirmed. Generated ${result.prs.length} Purchase Requisition(s).`,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

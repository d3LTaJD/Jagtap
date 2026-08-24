const ProformaInvoice = require('../models/ProformaInvoice');
const PurchaseOrder = require('../models/PurchaseOrder');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const proformaInvoiceAiService = require('../services/proformaInvoiceAiService');
const { logActivity } = require('../utils/logger');

/**
 * List Proforma Invoices (PIs) with reconciliation filters
 */
exports.getProformaInvoices = async (req, res, next) => {
  try {
    const { status, vendorId, poId, isClean, search, page = 1, limit = 50 } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.reconciliationStatus = status;
    }
    if (vendorId) {
      query.vendor = vendorId;
    }
    if (poId) {
      query.matchedPo = poId;
    }
    if (isClean === 'true') {
      query.isCleanMatch = true;
    } else if (isClean === 'false') {
      query.isCleanMatch = false;
    }
    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { piId: regex },
        { piNumber: regex },
        { hitNumber: regex }
      ];
    }

    const total = await ProformaInvoice.countDocuments(query);
    const proformaInvoices = await ProformaInvoice.find(query)
      .populate('vendor', 'name email mobile gstin')
      .populate('matchedPo', 'poId hitNumber grandTotal expectedDeliveryDate status items')
      .populate('reviewedBy', 'name email role')
      .sort({ piDate: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      status: 'success',
      total,
      data: { proformaInvoices }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get single Proforma Invoice detail with PO side-by-side comparison
 */
exports.getProformaInvoice = async (req, res, next) => {
  try {
    const pi = await ProformaInvoice.findById(req.params.id)
      .populate('vendor')
      .populate('matchedPo')
      .populate('reviewedBy', 'name email role');

    if (!pi) {
      return res.status(404).json({ status: 'fail', message: 'Proforma Invoice not found' });
    }

    res.status(200).json({
      status: 'success',
      data: { proformaInvoice: pi }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Reconcile Vendor PI against Open PO (Manual upload or API dispatch)
 */
exports.reconcilePi = async (req, res, next) => {
  try {
    const { poId, piData } = req.body;

    const pi = await proformaInvoiceAiService.reconcilePiAgainstPo({
      poId,
      piData,
      user: req.user
    });

    if (typeof req.get === 'function') {
      await logActivity({
        req,
        action: 'RECONCILE_PI',
        module: 'Purchase',
        resourceId: pi._id,
        resourceName: pi.piNumber,
        details: `PI ${pi.piNumber} reconciled against PO ${poId} (Result: ${pi.reconciliationStatus})`
      });
    }

    res.status(201).json({
      status: 'success',
      message: `Proforma Invoice ${pi.piNumber} reconciled (${pi.reconciliationStatus}).`,
      data: { proformaInvoice: pi }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Review & Override PI Deviations (Purchase Manager / Director)
 */
exports.reviewDeviations = async (req, res, next) => {
  try {
    const { action, reviewNotes } = req.body; // action: 'ACCEPT_OVERRIDE' | 'REJECT'
    const { hasPermission } = require('../config/permissions');

    // 1. Strict Backend RBAC Verification
    if (!hasPermission(req.user, 'Purchase', 'overridePI')) {
      return res.status(403).json({
        status: 'error',
        message: 'Forbidden: Only Purchase Manager, Director, or authorized higher roles can review or override PI deviations.'
      });
    }

    // 2. Validate Action
    if (!action || !['ACCEPT_OVERRIDE', 'REJECT'].includes(action)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid action. Action must be either "ACCEPT_OVERRIDE" or "REJECT".'
      });
    }

    // 3. Mandatory Review Justification Reason
    if (!reviewNotes || typeof reviewNotes !== 'string' || reviewNotes.trim().length < 3) {
      return res.status(400).json({
        status: 'fail',
        message: 'A review reason/justification is strictly required to override or reject PI deviations.'
      });
    }

    const pi = await ProformaInvoice.findById(req.params.id).populate('matchedPo');
    if (!pi) {
      return res.status(404).json({ status: 'fail', message: 'Proforma Invoice not found' });
    }

    const trimmedReason = reviewNotes.trim();
    const now = new Date();

    if (action === 'ACCEPT_OVERRIDE') {
      pi.reconciliationStatus = 'MANUALLY_OVERRIDDEN';
      pi.deviations.forEach(d => {
        d.status = 'ACCEPTED_OVERRIDE';
        d.reviewedBy = req.user._id;
        d.reviewedAt = now;
      });

      if (pi.matchedPo) {
        pi.matchedPo.status = 'PI_MATCHED';
        await pi.matchedPo.save();
      }
    } else if (action === 'REJECT') {
      pi.reconciliationStatus = 'REJECTED';
      pi.deviations.forEach(d => {
        d.status = 'REJECTED';
        d.reviewedBy = req.user._id;
        d.reviewedAt = now;
      });

      if (pi.matchedPo) {
        pi.matchedPo.status = 'ISSUED_TO_VENDOR';
        await pi.matchedPo.save();
      }
    }

    pi.reviewedBy = req.user._id;
    pi.reviewedAt = now;
    pi.reviewNotes = trimmedReason;
    await pi.save();

    const populatedPi = await ProformaInvoice.findById(pi._id)
      .populate('vendor')
      .populate('matchedPo')
      .populate('reviewedBy', 'name email role');

    if (typeof req.get === 'function') {
      await logActivity({
        req,
        action: 'REVIEW_PI_DEVIATIONS',
        module: 'Purchase',
        resourceId: pi._id,
        resourceName: pi.piNumber,
        details: `PI ${pi.piNumber} deviations decision: ${action}. Reason: "${trimmedReason}"`
      });
    }

    res.status(200).json({
      status: 'success',
      message: `Proforma Invoice deviations successfully marked as ${action}.`,
      data: { proformaInvoice: populatedPi }
    });
  } catch (err) {
    next(err);
  }
};

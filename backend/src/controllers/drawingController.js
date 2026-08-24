const Drawing = require('../models/Drawing');
const Quotation = require('../models/Quotation');
const Customer = require('../models/Customer');
const Enquiry = require('../models/Enquiry');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const tdsService = require('../services/tdsService');
const localStorageService = require('../services/localStorageService');
const extractionPipeline = require('../services/extraction/ExtractionPipeline');
const { getNextSequenceValue } = require('../utils/counter');
const { logActivity } = require('../utils/logger');

/**
 * List all drawings with queue filtering & search
 */
exports.getDrawings = async (req, res, next) => {
  try {
    const { queue = 'all', status, search, vendor, page = 1, limit = 50 } = req.query;

    const query = {};

    if (queue === 'pending') {
      query.status = { $in: ['PENDING_UPLOAD', 'UNDER_REVIEW', 'REVISION_REQUESTED'] };
    } else if (queue === 'vendor') {
      query.vendor = { $ne: null };
    } else if (queue === 'escalated') {
      query.isEscalated = true;
    } else if (queue === 'approved') {
      query.status = 'APPROVED';
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (vendor) {
      query.vendor = vendor;
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { drawingId: regex },
        { drawingNumber: regex },
        { drawingTitle: regex }
      ];
    }

    const total = await Drawing.countDocuments(query);
    const drawings = await Drawing.find(query)
      .populate('customer', 'companyName primaryContactName emailAddress customerId')
      .populate('quotation', 'quotationId grandTotal status')
      .populate('vendor', 'companyName vendorId phone')
      .populate('assignedTo', 'name email role')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      status: 'success',
      total,
      data: { drawings }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get single drawing with full revision history
 */
exports.getDrawing = async (req, res, next) => {
  try {
    const drawing = await Drawing.findById(req.params.id)
      .populate('customer')
      .populate('quotation')
      .populate('enquiry')
      .populate('vendor')
      .populate('assignedTo', 'name email role')
      .populate('revisions.submittedBy', 'name email role')
      .populate('revisions.reviewedBy', 'name email role')
      .populate('revisions.approvedBy', 'name email role');

    if (!drawing) {
      return res.status(404).json({ status: 'fail', message: 'Drawing not found' });
    }

    res.status(200).json({
      status: 'success',
      data: { drawing }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Manually create a new Drawing
 */
exports.createDrawing = async (req, res, next) => {
  try {
    const {
      quotationId,
      customerId,
      drawingNumber,
      drawingTitle,
      drawingType = 'INTERNAL_GA',
      vendorId,
      vendorSlaDeadline,
      assignedTo,
      notes
    } = req.body;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(400).json({ status: 'fail', message: 'Valid Customer is required.' });
    }

    const now = new Date();
    const prefix = `DWG-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const seq = await getNextSequenceValue(prefix);
    const drawingId = `${prefix}-${String(seq).padStart(4, '0')}`;

    let quotation = null;
    let requirements = {};

    if (quotationId) {
      quotation = await Quotation.findById(quotationId);
      if (quotation && quotation.items) {
        requirements = {
          lineItems: quotation.items.map((it, idx) => ({
            itemNo: idx + 1,
            description: it.description,
            size: it.dynamicFields?.valve_size || it.size,
            pressureClass: it.dynamicFields?.valve_class || it.pressureClass,
            valveType: it.dynamicFields?.valve_type || it.productCategory,
            materialGrade: it.dynamicFields?.valve_body_moc || it.materialGrade,
            quantity: it.quantity || 1
          }))
        };
      }
    }

    const drawing = await Drawing.create({
      drawingId,
      quotation: quotation?._id,
      customer: customer._id,
      drawingNumber: drawingNumber || `DWG-${Date.now().toString().slice(-4)}`,
      drawingTitle: drawingTitle || 'General Arrangement Drawing',
      drawingType,
      source: vendorId ? 'VENDOR_EXTERNAL' : 'MANUAL_UPLOAD',
      vendor: vendorId || undefined,
      vendorSlaDeadline: vendorSlaDeadline ? new Date(vendorSlaDeadline) : undefined,
      assignedTo: assignedTo || req.user._id,
      requirements,
      notes: notes || '',
      status: 'PENDING_UPLOAD',
      currentRevisionNumber: 0,
      revisions: []
    });

    if (typeof req.get === 'function') {
      await logActivity({
        req,
        action: 'CREATE',
        module: 'Drawing',
        resourceId: drawing._id,
        resourceName: drawing.drawingId,
        details: `Manual Drawing request created: ${drawing.drawingId}`
      });
    }

    res.status(201).json({
      status: 'success',
      message: 'Drawing request created successfully',
      data: { drawing }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Upload a new revision for a drawing
 */
exports.uploadRevision = async (req, res, next) => {
  try {
    const drawing = await Drawing.findById(req.params.id).populate('customer quotation');
    if (!drawing) {
      return res.status(404).json({ status: 'fail', message: 'Drawing not found' });
    }

    if (!req.file) {
      return res.status(400).json({ status: 'fail', message: 'Drawing file (.pdf, .dwg, .dxf) is required.' });
    }

    // Save binary file locally
    const fileKey = await localStorageService.uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    const fileUrl = `/api/files/download-local/${fileKey}`;

    // Run AI / Deterministic parameter extraction on filename and context
    const extractedSpecs = {};
    const textContext = `${drawing.drawingTitle} ${req.file.originalname} ${req.body.comments || ''}`;
    const pipelineResults = extractionPipeline.processDocument(textContext, {
      documentId: drawing.drawingId,
      documentType: 'DRAWING_REVISION'
    });

    if (pipelineResults && pipelineResults.fields) {
      const f = pipelineResults.fields;
      if (f.valve_type) extractedSpecs.valveType = f.valve_type;
      if (f.valve_size) extractedSpecs.size = f.valve_size;
      if (f.valve_class) extractedSpecs.pressureClass = f.valve_class;
      if (f.shellMaterial) extractedSpecs.bodyMaterial = f.shellMaterial;
      if (f.endConnection) extractedSpecs.endConnection = f.endConnection;
      if (f.designStandard) extractedSpecs.designStandard = f.designStandard;
      if (f.drawingNumber) extractedSpecs.drawingNumber = f.drawingNumber;
    }

    // Build initial checklist
    const tdsChecklist = [
      {
        code: 'CHK_STD',
        category: 'Standard Conformance',
        checkName: 'Design Standard Verification (API 6D / ASME B16.34)',
        expectedValue: drawing.requirements?.designStandard || 'API 6D',
        actualValue: extractedSpecs.designStandard?.value || 'API 6D',
        status: 'PENDING',
        remarks: ''
      },
      {
        code: 'CHK_DIM',
        category: 'Dimension Check',
        checkName: 'Face-to-Face Dimensions (ASME B16.10)',
        expectedValue: 'As per ASME B16.10',
        actualValue: extractedSpecs.faceToFace?.value || 'Standard',
        status: 'PENDING',
        remarks: ''
      },
      {
        code: 'CHK_MOC_BODY',
        category: 'Material Match',
        checkName: 'Body / Shell Material Verification',
        expectedValue: drawing.requirements?.material || 'ASTM A216 WCB',
        actualValue: extractedSpecs.bodyMaterial?.value || drawing.requirements?.material || 'ASTM A216 WCB',
        status: 'PENDING',
        remarks: ''
      },
      {
        code: 'CHK_RATING',
        category: 'Pressure/Hydro Rating',
        checkName: 'Pressure Class & Rating Verification',
        expectedValue: drawing.requirements?.pressureClass || 'Class 150',
        actualValue: extractedSpecs.pressureClass?.value || drawing.requirements?.pressureClass || 'Class 150',
        status: 'PENDING',
        remarks: ''
      },
      {
        code: 'CHK_CONN',
        category: 'End Connection',
        checkName: 'Flange End Connection & Facing',
        expectedValue: drawing.requirements?.endConnection || 'Flanged RF',
        actualValue: extractedSpecs.endConnection?.value || drawing.requirements?.endConnection || 'Flanged RF',
        status: 'PENDING',
        remarks: ''
      }
    ];

    const nextRevNo = drawing.revisions.length;
    const revLabel = `Rev ${String(nextRevNo).padStart(2, '0')}`;

    const newRevision = {
      revisionNumber: nextRevNo,
      revisionLabel: revLabel,
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      storagePath: fileKey,
      extractedParameters: extractedSpecs,
      tdsChecklist,
      status: 'UNDER_REVIEW',
      submittedBy: req.user._id,
      submittedAt: new Date(),
      comments: req.body.comments || `Uploaded ${req.file.originalname}`
    };

    drawing.revisions.push(newRevision);
    drawing.currentRevisionNumber = nextRevNo;
    drawing.status = 'UNDER_REVIEW';
    await drawing.save();

    if (typeof req.get === 'function') {
      await logActivity({
        req,
        action: 'UPDATE',
        module: 'Drawing',
        resourceId: drawing._id,
        resourceName: drawing.drawingId,
        details: `New revision ${revLabel} uploaded for drawing ${drawing.drawingId}`
      });
    }

    res.status(200).json({
      status: 'success',
      message: `Revision ${revLabel} uploaded successfully and submitted for TDS review.`,
      data: { drawing, revision: newRevision }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update TDS Checklist items for a revision
 */
exports.updateChecklist = async (req, res, next) => {
  try {
    const { revisionNumber, checklist = [] } = req.body;
    const drawing = await Drawing.findById(req.params.id);
    if (!drawing) {
      return res.status(404).json({ status: 'fail', message: 'Drawing not found' });
    }

    const rev = drawing.revisions.find(r => r.revisionNumber === Number(revisionNumber));
    if (!rev) {
      return res.status(404).json({ status: 'fail', message: `Revision ${revisionNumber} not found.` });
    }

    rev.tdsChecklist = checklist;
    await drawing.save();

    res.status(200).json({
      status: 'success',
      message: 'TDS Checklist updated successfully',
      data: { drawing }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Approve a Drawing Revision & Freeze Active Approved Version
 */
exports.approveDrawing = async (req, res, next) => {
  try {
    const { revisionNumber = 0, comments = '' } = req.body;
    const drawing = await tdsService.approveDrawingRevision({
      drawingId: req.params.id,
      revisionNumber,
      user: req.user,
      comments
    });

    if (typeof req.get === 'function') {
      await logActivity({
        req,
        action: 'APPROVE',
        module: 'Drawing',
        resourceId: drawing._id,
        resourceName: drawing.drawingId,
        details: `Drawing ${drawing.drawingId} Revision ${revisionNumber} approved.`
      });
    }

    res.status(200).json({
      status: 'success',
      message: `Drawing ${drawing.drawingId} officially APPROVED! Production Work Order gate is unlocked.`,
      data: { drawing }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Reject or Request Revision for a Drawing
 */
exports.rejectDrawing = async (req, res, next) => {
  try {
    const { revisionNumber = 0, reason = '', decision = 'REVISION_REQUESTED' } = req.body;
    const drawing = await Drawing.findById(req.params.id);
    if (!drawing) {
      return res.status(404).json({ status: 'fail', message: 'Drawing not found' });
    }

    const rev = drawing.revisions.find(r => r.revisionNumber === Number(revisionNumber));
    if (rev) {
      rev.status = decision;
      rev.reviewedBy = req.user._id;
      rev.reviewedAt = new Date();
      rev.comments = reason;
    }

    drawing.status = decision;
    await drawing.save();

    if (typeof req.get === 'function') {
      await logActivity({
        req,
        action: 'REJECT',
        module: 'Drawing',
        resourceId: drawing._id,
        resourceName: drawing.drawingId,
        details: `Drawing ${drawing.drawingId} set to ${decision}. Reason: ${reason}`
      });
    }

    res.status(200).json({
      status: 'success',
      message: `Drawing ${drawing.drawingId} status updated to ${decision}.`,
      data: { drawing }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Trigger Director Escalation
 */
exports.escalateDrawing = async (req, res, next) => {
  try {
    const { reason = 'Manual escalation by TDS Engineer' } = req.body;
    const drawing = await Drawing.findById(req.params.id).populate('customer quotation');
    if (!drawing) {
      return res.status(404).json({ status: 'fail', message: 'Drawing not found' });
    }

    drawing.isEscalated = true;
    drawing.escalatedAt = new Date();
    drawing.escalationReason = reason;
    drawing.directorNotified = true;
    await drawing.save();

    const { notifyRoles } = require('../services/notificationService');
    await notifyRoles({
      roles: ['DIR', 'SA'],
      type: 'DRAWING_DELAY_ESCALATED',
      title: `🚨 Urgent Escalation: Drawing ${drawing.drawingId}`,
      message: `Drawing ${drawing.drawingId} manually escalated to Director: "${reason}"`,
      related_id: drawing._id
    });

    res.status(200).json({
      status: 'success',
      message: `Drawing ${drawing.drawingId} escalated to Director.`,
      data: { drawing }
    });
  } catch (err) {
    next(err);
  }
};

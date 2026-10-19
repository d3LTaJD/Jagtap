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

/**
 * Download or View Rev 00 Baseline Technical Specification PDF
 */
exports.downloadBaselineSpecPdf = async (req, res, next) => {
  try {
    const drawing = await Drawing.findById(req.params.id).populate('customer quotation');
    if (!drawing) {
      return res.status(404).json({ status: 'fail', message: 'Drawing not found' });
    }

    const puppeteer = require('puppeteer');
    const reqs = drawing.requirements || {};
    const rev0 = drawing.revisions?.find(r => r.revisionNumber === 0) || {};
    const specs = rev0.extractedParameters || {
      valveType: reqs.valveType || 'Ball Valve',
      size: reqs.size || '100 mm',
      pressureClass: reqs.pressureClass || '300#',
      bodyMaterial: reqs.material || 'ASTM A216 Gr. WCC',
      endConnection: reqs.endConnection || 'Butt weld',
      designStandard: reqs.designStandard || 'API 6D'
    };

    const clientName = drawing.customer?.companyName || drawing.quotation?.customer?.companyName || 'Valued Customer';
    const quoteId = drawing.quotation?.quotationId || 'Internal Ref';
    const dwgId = drawing.drawingId || 'DWG-BASELINE';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Drawing Baseline - ${dwgId}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 25px; color: #1e293b; background: #fff; }
    .header { border-bottom: 2px solid #0b3b60; padding-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
    .brand { font-size: 20px; font-weight: 900; color: #0b3b60; letter-spacing: 0.5px; }
    .subbrand { font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase; margin-top: 2px; }
    .badge { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; font-weight: 800; font-size: 11px; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; }
    .title-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; margin: 20px 0; display: flex; justify-content: space-between; }
    .meta-col { font-size: 11px; line-height: 1.6; }
    .meta-col strong { color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
    th { background: #0b3b60; color: #fff; text-align: left; padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { border-bottom: 1px solid #e2e8f0; padding: 9px 12px; font-size: 11.5px; }
    tr:nth-child(even) td { background: #f8fafc; }
    .stamp-box { margin-top: 30px; border: 2px dashed #059669; background: #ecfdf5; border-radius: 12px; padding: 14px; text-align: center; }
    .stamp-title { color: #065f46; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
    .stamp-sub { color: #047857; font-size: 11px; margin-top: 3px; font-weight: 600; }
    .footer { margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 10px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">PETRO VALVES PVT. LTD.</div>
      <div class="subbrand">Technical Data Sheet (TDS) &amp; Design Engineering</div>
    </div>
    <div class="badge">Official Rev 00 Baseline</div>
  </div>

  <div class="title-box">
    <div class="meta-col">
      <div><strong>Drawing Request ID:</strong> ${dwgId}</div>
      <div><strong>Drawing Title:</strong> ${drawing.drawingTitle || 'Technical Drawing Specification'}</div>
      <div><strong>Customer / Client:</strong> ${clientName}</div>
    </div>
    <div class="meta-col" style="text-align: right;">
      <div><strong>Quotation Reference:</strong> ${quoteId}</div>
      <div><strong>Revision:</strong> Rev 00 (Baseline Specification)</div>
      <div><strong>Date:</strong> ${new Date(drawing.createdAt).toLocaleDateString('en-GB')}</div>
    </div>
  </div>

  <h4 style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin: 15px 0 8px 0; color: #0b3b60;">
    Extracted Technical Baseline Parameters
  </h4>

  <table>
    <thead>
      <tr>
        <th style="width: 40%;">Parameter</th>
        <th style="width: 60%;">Baseline Value</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>Valve Type</td><td><strong>${specs.valveType?.value || specs.valveType || 'Ball Valve'}</strong></td></tr>
      <tr><td>Nominal Size</td><td><strong>${specs.size?.value || specs.size || '100 mm (4")'}</strong></td></tr>
      <tr><td>Pressure Class</td><td><strong>${specs.pressureClass?.value || specs.pressureClass || '300#'}</strong></td></tr>
      <tr><td>Body Material (MOC)</td><td><strong>${specs.bodyMaterial?.value || specs.bodyMaterial || 'ASTM A216 Gr. WCC'}</strong></td></tr>
      <tr><td>Design Standard</td><td><strong>${specs.designStandard?.value || specs.designStandard || 'API 6D'}</strong></td></tr>
      <tr><td>End Connection</td><td><strong>${specs.endConnection?.value || specs.endConnection || 'Butt weld (BW)'}</strong></td></tr>
      <tr><td>Drawing Number Reference</td><td><strong>${drawing.drawingNumber || 'DWG-CUST-REF'}</strong></td></tr>
    </tbody>
  </table>

  <div class="stamp-box">
    <div class="stamp-title">✓ Verified Technical Baseline Snapshot</div>
    <div class="stamp-sub">This baseline was automatically extracted from Quotation ${quoteId} and officially locked as Rev 00 for production Work Order gate release.</div>
  </div>

  <div class="footer">
    <div>Format No. TDS/DWG/01 Rev 00 &bull; Petro Valves Quality &amp; Engineering</div>
    <div>Generated by Petro Valves Workflow Automation</div>
  </div>
</body>
</html>
    `;

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '8mm', bottom: '8mm', left: '10mm', right: '10mm' }
      });

      const safeName = `${drawing.drawingNumber || drawing.drawingId}_Rev00_Baseline.pdf`.replace(/[\/\\?%*:|"<>]/g, '_');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
      res.send(pdfBuffer);
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error('[Baseline PDF Error]', err);
    next(err);
  }
};

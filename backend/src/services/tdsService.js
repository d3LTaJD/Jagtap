const Drawing = require('../models/Drawing');
const WorkOrder = require('../models/WorkOrder');
const Quotation = require('../models/Quotation');
const Enquiry = require('../models/Enquiry');
const Customer = require('../models/Customer');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const SystemSettings = require('../models/SystemSettings');
const { getNextSequenceValue } = require('../utils/counter');
const { createNotification, notifyRoles, sendWhatsAppNotification } = require('./notificationService');
const extractionPipeline = require('./extraction/ExtractionPipeline');
const drawingExtractor = require('./extraction/extractors/DrawingExtractor');
const localStorageService = require('./localStorageService');

function unpackStringValue(spec) {
  if (!spec) return '';
  if (typeof spec === 'string') return spec;
  if (typeof spec === 'object') {
    return spec.normalizedValue || spec.value || spec.rawValue || '';
  }
  return String(spec);
}

/**
 * Standard TDS Technical Checklist Generator
 * Generates initial verification checklist comparing Quotation specs vs Extracted Drawing specs.
 */
function generateTdsChecklist(expectedSpecs = {}, extractedSpecs = {}) {
  const checklist = [
    {
      code: 'CHK_STD',
      category: 'Standard Conformance',
      checkName: 'Design Standard Verification (e.g. API 6D / ASME B16.34)',
      expectedValue: unpackStringValue(expectedSpecs.designStandard) || 'API 6D',
      actualValue: unpackStringValue(extractedSpecs.designStandard) || '',
      status: 'PENDING',
      remarks: ''
    },
    {
      code: 'CHK_DIM',
      category: 'Dimension Check',
      checkName: 'Face-to-Face & End-to-End Dimensions (ASME B16.10)',
      expectedValue: unpackStringValue(expectedSpecs.faceToFace) || 'As per ASME B16.10',
      actualValue: unpackStringValue(extractedSpecs.faceToFace) || '',
      status: 'PENDING',
      remarks: ''
    },
    {
      code: 'CHK_MOC_BODY',
      category: 'Material Match',
      checkName: 'Shell / Body Material Compliance (ASTM Grade)',
      expectedValue: unpackStringValue(expectedSpecs.material || expectedSpecs.bodyMaterial) || 'ASTM A216 WCB',
      actualValue: unpackStringValue(extractedSpecs.bodyMaterial) || '',
      status: 'PENDING',
      remarks: ''
    },
    {
      code: 'CHK_RATING',
      category: 'Pressure/Hydro Rating',
      checkName: 'Pressure Class & Rating Verification',
      expectedValue: unpackStringValue(expectedSpecs.pressureClass) || 'Class 150',
      actualValue: unpackStringValue(extractedSpecs.pressureClass) || '',
      status: 'PENDING',
      remarks: ''
    },
    {
      code: 'CHK_CONN',
      category: 'End Connection',
      checkName: 'Flange End Facing & Drill Pattern Compatibility',
      expectedValue: unpackStringValue(expectedSpecs.endConnection) || 'Flanged RF',
      actualValue: unpackStringValue(extractedSpecs.endConnection) || '',
      status: 'PENDING',
      remarks: ''
    }
  ];

  // Auto-evaluate checklist items where exact normalized matches exist
  checklist.forEach(item => {
    if (item.expectedValue && item.actualValue) {
      const exp = String(item.expectedValue).toLowerCase().replace(/[^a-z0-9]/g, '');
      const act = String(item.actualValue).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (exp && act && (exp.includes(act) || act.includes(exp))) {
        item.status = 'PASS';
        item.remarks = 'AI extracted value matches quotation specifications.';
      }
    }
  });

  return checklist;
}

/**
 * 1. AUTO CREATE DRAWING REQUEST WHEN QUOTATION IS APPROVED (Idempotent)
 */
exports.createDrawingRequestFromQuotation = async (quotationDoc) => {
  try {
    const quotation = typeof quotationDoc.populate === 'function' 
      ? quotationDoc 
      : await Quotation.findById(quotationDoc._id || quotationDoc).populate('customer').populate('enquiry');

    if (!quotation) {
      console.warn('[TDS Service] Quotation not found for drawing creation.');
      return null;
    }

    // Idempotency check: Do not duplicate if drawing already exists for this quotation
    const existing = await Drawing.findOne({ quotation: quotation._id });
    if (existing) {
      console.log(`[TDS Service] Idempotent check: Drawing request ${existing.drawingId} already exists for quotation ${quotation.quotationId}.`);
      return existing;
    }

    // Generate unique sequential Drawing ID: DWG-YYYY-MM-NNNN
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `DWG-${year}-${month}`;
    const seq = await getNextSequenceValue(prefix);
    const drawingId = `${prefix}-${String(seq).padStart(4, '0')}`;

    // Extract item summaries from quotation
    const items = quotation.items || [];
    const firstItem = items[0] || {};
    const primarySize = firstItem.dynamicFields?.valve_size || firstItem.size || 'Multi-Size';
    const primaryClass = firstItem.dynamicFields?.valve_class || firstItem.pressureClass || 'Multi-Class';
    const primaryMoc = firstItem.dynamicFields?.valve_body_moc || firstItem.materialGrade || 'ASTM A216 WCB';
    const primaryType = firstItem.dynamicFields?.valve_type || firstItem.productCategory || 'Valve';
    const primaryStd = firstItem.dynamicFields?.valve_design_std || firstItem.applicableStandard || 'API 6D';

    const requirements = {
      valveType: primaryType,
      size: primarySize,
      pressureClass: primaryClass,
      material: primaryMoc,
      quantity: items.reduce((acc, it) => acc + (it.quantity || 1), 0),
      designStandard: primaryStd,
      endConnection: firstItem.dynamicFields?.valve_end_connection || 'Flanged RF',
      operation: firstItem.dynamicFields?.valve_operating || 'Manual',
      lineItems: items.map((it, idx) => ({
        itemNo: idx + 1,
        description: it.description,
        size: it.dynamicFields?.valve_size || it.size,
        pressureClass: it.dynamicFields?.valve_class || it.pressureClass,
        valveType: it.dynamicFields?.valve_type || it.productCategory,
        materialGrade: it.dynamicFields?.valve_body_moc || it.materialGrade,
        quantity: it.quantity || 1
      }))
    };

    const drawing = await Drawing.create({
      drawingId,
      quotation: quotation._id,
      enquiry: quotation.enquiry?._id || quotation.enquiry,
      customer: quotation.customer?._id || quotation.customer,
      drawingNumber: `DWG-REQ-${quotation.quotationId}`,
      drawingTitle: `GA Drawing for ${primarySize} ${primaryClass} ${primaryType}`,
      drawingType: 'INTERNAL_GA',
      source: 'QUOTATION_AUTO',
      requirements,
      status: 'PENDING_UPLOAD',
      currentRevisionNumber: 0,
      revisions: []
    });

    console.log(`[TDS Service] ✅ Auto-created Drawing Request ${drawing.drawingId} for Quotation ${quotation.quotationId}`);

    // Notify TDS Team via In-App Push & Role Broadcast
    await notifyRoles({
      roles: ['DE', 'QCS', 'TA', 'SA'],
      type: 'DRAWING_REQUEST_CREATED',
      title: `📐 Drawing Request Created: ${drawing.drawingId}`,
      message: `Quotation ${quotation.quotationId} for ${quotation.customer?.companyName || 'Client'} approved by Director. Drawing request auto-generated for ${items.length} valve item(s).`,
      related_id: drawing._id
    });

    // Send WhatsApp notification trigger
    const customerPhone = quotation.customer?.mobileNumber || quotation.customer?.phone;
    await sendWhatsAppNotification({
      to: customerPhone || 'TDS_INTERNAL_GROUP',
      message: `*PetroValve TDS Alert*: Drawing Request *${drawing.drawingId}* created for Quotation *${quotation.quotationId}*. Requirements: ${items.length} line items (${primarySize}, ${primaryClass}, ${primaryType}).`,
      entityType: 'Drawing',
      entityId: drawing._id
    });

    return drawing;
  } catch (err) {
    console.error('[TDS Service] Error in createDrawingRequestFromQuotation:', err);
    throw err;
  }
};

/**
 * 2. CUSTOMER DRAWING EMAIL INGESTION & EXTRACTION
 */
exports.routeCustomerDrawingFromEmail = async ({
  customer,
  emailSubject = '',
  emailBody = '',
  attachments = [],
  threadId = ''
}) => {
  try {
    if (!customer) {
      return { success: false, reason: 'CUSTOMER_REQUIRED' };
    }

    const fullContext = `${emailSubject}\n${emailBody}`;

    // 1. Identify drawing files (.dwg, .dxf, .pdf)
    const drawingFiles = attachments.filter(att => {
      const name = (att.filename || att.originalFileName || '').toLowerCase();
      return name.endsWith('.dwg') || name.endsWith('.dxf') || name.endsWith('.pdf');
    });

    if (drawingFiles.length === 0 && !drawingExtractor.extract(fullContext)) {
      return { success: false, reason: 'NO_DRAWING_CONTENT' };
    }

    // 2. Associate with active Quotation / Drawing with Wrong Association Protection
    const quotMatch = fullContext.match(/QT-\d{4}-\d{2}-\d{4}/i);
    const dwgMatch = fullContext.match(/DWG-\d{4}-\d{2}-\d{4}/i);

    let targetDrawing = null;

    if (dwgMatch) {
      targetDrawing = await Drawing.findOne({ drawingId: dwgMatch[0].toUpperCase() }).populate('customer quotation');
      // Verify customer match to prevent cross-customer drawing leakage
      if (targetDrawing && String(targetDrawing.customer?._id) !== String(customer._id)) {
        console.warn(`[TDS Security] Drawing token ${dwgMatch[0]} does not belong to customer ${customer.companyName}! Flagging for review.`);
        targetDrawing = null;
      }
    }

    if (!targetDrawing && quotMatch) {
      const targetQuot = await Quotation.findOne({ quotationId: quotMatch[0].toUpperCase() });
      if (targetQuot) {
        // Customer isolation verification
        if (String(targetQuot.customer) === String(customer._id)) {
          targetDrawing = await Drawing.findOne({ quotation: targetQuot._id }).populate('customer quotation');
        } else {
          console.warn(`[TDS Security] Quotation token ${quotMatch[0]} does not belong to customer ${customer.companyName}! Cross-customer association rejected.`);
        }
      }
    }

    // Fallback: match by Customer's most recent active drawing
    if (!targetDrawing) {
      targetDrawing = await Drawing.findOne({
        customer: customer._id,
        status: { $in: ['PENDING_UPLOAD', 'UNDER_REVIEW', 'REVISION_REQUESTED'] }
      }).sort({ createdAt: -1 }).populate('customer quotation');
    }

    if (!targetDrawing) {
      console.log(`[TDS Service] No direct active drawing match for ${customer.companyName}. Creating new customer drawing record.`);
      const now = new Date();
      const prefix = `DWG-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const seq = await getNextSequenceValue(prefix);
      const drawingId = `${prefix}-${String(seq).padStart(4, '0')}`;

      targetDrawing = await Drawing.create({
        drawingId,
        customer: customer._id,
        drawingNumber: `DWG-CUST-${Date.now().toString().slice(-4)}`,
        drawingTitle: `Customer Inbound Drawing - ${emailSubject.slice(0, 50)}`,
        drawingType: 'CUSTOMER_GA',
        source: 'CUSTOMER_EMAIL',
        status: 'UNDER_REVIEW',
        currentRevisionNumber: 0,
        revisions: []
      });
    }

    // 3. Extract parameters with deterministic engineering pipeline + provenance
    const extractedSpecs = {};
    const pipelineResults = extractionPipeline.processDocument(fullContext, {
      documentId: targetDrawing.drawingId,
      documentType: 'CUSTOMER_DRAWING'
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

    // 4. Pre-fill TDS Technical Checklist
    const tdsChecklist = generateTdsChecklist(targetDrawing.requirements || {}, extractedSpecs);

    // 5. Build New Revision
    const nextRevNo = targetDrawing.revisions.length;
    const revLabel = `Rev ${String(nextRevNo).padStart(2, '0')}`;
    const primaryFile = drawingFiles[0] || {};

    const revisionRecord = {
      revisionNumber: nextRevNo,
      revisionLabel: revLabel,
      fileUrl: primaryFile.url || `/api/files/download-local/${primaryFile.filename || 'drawing.pdf'}`,
      fileName: primaryFile.filename || primaryFile.originalFileName || 'Inbound_Drawing.pdf',
      fileSize: primaryFile.size || 0,
      mimeType: primaryFile.contentType || 'application/pdf',
      storagePath: primaryFile.storagePath || primaryFile.filename,
      extractedParameters: extractedSpecs,
      tdsChecklist,
      status: 'UNDER_REVIEW',
      submittedAt: new Date(),
      comments: `Inbound drawing received via email from ${customer.primaryContactName || customer.companyName}. Subject: ${emailSubject}`
    };

    targetDrawing.revisions.push(revisionRecord);
    targetDrawing.currentRevisionNumber = nextRevNo;
    targetDrawing.status = 'UNDER_REVIEW';
    await targetDrawing.save();

    console.log(`[TDS Service] ✅ Processed Customer Drawing email into ${targetDrawing.drawingId} (${revLabel}). Routed to TDS Queue.`);

    // Notify TDS Engineers
    await notifyRoles({
      roles: ['DE', 'QCS', 'TA', 'SA'],
      type: 'DRAWING_SUBMITTED_FOR_REVIEW',
      title: `📥 Inbound Drawing ${targetDrawing.drawingId} (${revLabel}) Ready for Review`,
      message: `Customer drawing uploaded with AI pre-filled checklist. Ready for TDS technical review.`,
      related_id: targetDrawing._id
    });

    return {
      success: true,
      drawingId: targetDrawing.drawingId,
      revision: revLabel,
      drawing: targetDrawing
    };
  } catch (err) {
    console.error('[TDS Service] Error in routeCustomerDrawingFromEmail:', err);
    throw err;
  }
};

/**
 * 3. VENDOR DRAWING SLA MONITORING & AUTOMATED WHATSAPP FOLLOW-UP
 */
exports.checkVendorSlaBreaches = async () => {
  try {
    const now = new Date();
    const overdueDrawings = await Drawing.find({
      vendor: { $ne: null },
      vendorSlaDeadline: { $lt: now },
      status: { $ne: 'APPROVED' }
    }).populate('vendor customer');

    let breachedCount = 0;
    for (const dwg of overdueDrawings) {
      dwg.slaBreached = true;

      // Controlled reminder policy: Only send follow-up once every 24 hours
      const lastSent = dwg.lastSlaFollowUpSentAt;
      const hoursSinceLastSent = lastSent ? (now - lastSent) / (1000 * 60 * 60) : 999;

      if (hoursSinceLastSent >= 24) {
        const vendorPhone = dwg.vendor?.phone || dwg.vendor?.contactMobile;
        const vendorName = dwg.vendor?.companyName || 'Vendor';

        await sendWhatsAppNotification({
          to: vendorPhone || 'VENDOR_DISPATCH',
          message: `*Urgent Reminder*: Drawing submission for *${dwg.drawingId}* (${dwg.drawingTitle}) is past SLA deadline. Please upload the required GA drawing immediately.`,
          entityType: 'Drawing',
          entityId: dwg._id
        });

        dwg.lastSlaFollowUpSentAt = now;
        breachedCount++;
      }

      await dwg.save();
    }

    if (breachedCount > 0) {
      console.log(`[TDS Scheduler] Processed ${breachedCount} vendor drawing SLA follow-up reminders.`);
    }

    return { processed: overdueDrawings.length, remindersSent: breachedCount };
  } catch (err) {
    console.error('[TDS Scheduler] Error in checkVendorSlaBreaches:', err.message);
  }
};

/**
 * 4. DIRECTOR DELAY ESCALATION SCHEDULER
 */
exports.checkDrawingDelayEscalations = async () => {
  try {
    const settings = await SystemSettings.findOne({ _singleton: 'global' });
    const thresholdDays = settings?.drawingDelayThresholdDays || 3;
    const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - thresholdMs);

    const delayedDrawings = await Drawing.find({
      status: { $in: ['PENDING_UPLOAD', 'UNDER_REVIEW', 'REVISION_REQUESTED'] },
      createdAt: { $lt: cutoffDate },
      isEscalated: { $ne: true }
    }).populate('customer quotation');

    let escalatedCount = 0;
    for (const dwg of delayedDrawings) {
      dwg.isEscalated = true;
      dwg.escalatedAt = new Date();
      dwg.escalationReason = `Drawing delayed beyond configured threshold of ${thresholdDays} days without approval.`;
      dwg.directorNotified = true;
      await dwg.save();

      // Dispatch escalation notification to Director and Super Admin
      await notifyRoles({
        roles: ['DIR', 'SA'],
        type: 'DRAWING_DELAY_ESCALATED',
        title: `🚨 Escalation: Drawing ${dwg.drawingId} Overdue (${thresholdDays}+ Days)`,
        message: `Drawing for Quotation ${dwg.quotation?.quotationId || 'N/A'} (${dwg.customer?.companyName || 'Customer'}) has remained unapproved for over ${thresholdDays} days. Immediate Director intervention required.`,
        related_id: dwg._id
      });

      escalatedCount++;
    }

    if (escalatedCount > 0) {
      console.log(`[TDS Scheduler] Escalated ${escalatedCount} delayed drawing(s) to Director.`);
    }

    return { escalatedCount };
  } catch (err) {
    console.error('[TDS Scheduler] Error in checkDrawingDelayEscalations:', err.message);
  }
};

/**
 * 5. APPROVE DRAWING REVISION & FREEZE ACTIVE VERSION
 */
exports.approveDrawingRevision = async ({ drawingId, revisionNumber, user, comments = '' }) => {
  const drawing = await Drawing.findById(drawingId).populate('customer quotation');
  if (!drawing) throw new Error('Drawing not found');

  const targetRev = drawing.revisions.find(r => r.revisionNumber === Number(revisionNumber));
  if (!targetRev) throw new Error(`Revision ${revisionNumber} not found in drawing ${drawing.drawingId}`);

  // Mark revision approved
  targetRev.status = 'APPROVED';
  targetRev.reviewedBy = user._id;
  targetRev.reviewedAt = new Date();
  targetRev.approvedBy = user._id;
  targetRev.approvedAt = new Date();
  targetRev.comments = comments || 'Approved by TDS Authority';

  // Mark all checklists as PASS or verified
  targetRev.tdsChecklist.forEach(item => {
    if (item.status === 'PENDING') item.status = 'PASS';
  });

  // Freeze activeApprovedRevision (Immutable Snapshot)
  drawing.activeApprovedRevision = targetRev;
  drawing.status = 'APPROVED';
  drawing.isEscalated = false;
  await drawing.save();

  console.log(`[TDS Service] ✅ Drawing ${drawing.drawingId} (${targetRev.revisionLabel}) APPROVED by ${user.name || user.email}.`);

  // Notify Sales and Production team
  await notifyRoles({
    roles: ['SALES', 'DIR', 'SA'],
    type: 'DRAWING_APPROVED',
    title: `✅ Drawing ${drawing.drawingId} APPROVED (${targetRev.revisionLabel})`,
    message: `Technical drawing approved. Work Order production gate is now UNLOCKED for Quotation ${drawing.quotation?.quotationId || 'N/A'}.`,
    related_id: drawing._id
  });

  return drawing;
};

/**
 * 6. AUTHORITATIVE HARD WORK ORDER RELEASE GATE (ZERO OVERRIDE)
 */
exports.enforceWorkOrderReleaseGate = async ({ workOrderId, user, releaseNotes = '' }) => {
  const workOrder = await WorkOrder.findById(workOrderId).populate('drawing quotation customer');
  if (!workOrder) {
    const err = new Error('Work Order not found.');
    err.statusCode = 404;
    throw err;
  }

  const drawing = workOrder.drawing;

  // HARD SYSTEM GATE: Zero Override Rule
  if (!drawing || drawing.status !== 'APPROVED' || !drawing.activeApprovedRevision) {
    const currentStatus = drawing ? drawing.status : 'NO_DRAWING_LINKED';
    const targetRevLabel = workOrder.approvedDrawingLabel || drawing?.revisions?.[drawing.revisions.length - 1]?.revisionLabel || 'Rev 00';
    const msg = `Production Release Blocked: The linked drawing (${targetRevLabel}) must be approved by TDS before this Work Order can be released. Drawing status is currently: ${currentStatus}.`;
    console.error(`[HARD GATE BLOCKED] Work Order ${workOrder.workOrderId} release attempt rejected. Status: ${currentStatus}`);
    
    const err = new Error(msg);
    err.statusCode = 403;
    err.gateBlocked = true;
    err.drawingStatus = currentStatus;
    throw err;
  }

  // Release Work Order with Frozen Approved Drawing Revision Snapshot
  const approvedRev = drawing.activeApprovedRevision;
  workOrder.status = 'RELEASED';
  workOrder.isDrawingApproved = true;
  workOrder.approvedDrawingRevision = approvedRev.revisionNumber;
  workOrder.approvedDrawingLabel = approvedRev.revisionLabel;
  workOrder.frozenRevisionSnapshot = {
    revisionNumber: approvedRev.revisionNumber,
    revisionLabel: approvedRev.revisionLabel,
    fileUrl: approvedRev.fileUrl,
    fileName: approvedRev.fileName,
    approvedAt: approvedRev.approvedAt || new Date(),
    approvedBy: approvedRev.approvedBy,
    extractedParameters: approvedRev.extractedParameters,
    tdsChecklist: approvedRev.tdsChecklist
  };
  workOrder.releasedBy = user._id;
  workOrder.releasedAt = new Date();
  workOrder.releaseNotes = releaseNotes || `Released with approved drawing ${drawing.drawingId} (${approvedRev.revisionLabel}).`;
  await workOrder.save();

  console.log(`[TDS Service] 🚀 WORK ORDER RELEASED: ${workOrder.workOrderId} linked to Drawing ${drawing.drawingId} (${approvedRev.revisionLabel})`);

  // Notify Production & Management
  await notifyRoles({
    roles: ['DIR', 'SA', 'QCS'],
    type: 'WORK_ORDER_RELEASED',
    title: `🏭 Work Order ${workOrder.workOrderId} Released to Production`,
    message: `Work Order released with Approved Drawing ${drawing.drawingId} (${approvedRev.revisionLabel}) for Customer ${workOrder.customer?.companyName || 'Client'}.`,
    related_id: workOrder._id
  });

  return workOrder;
};

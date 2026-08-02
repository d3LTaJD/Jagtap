const Enquiry = require('../models/Enquiry');
const Customer = require('../models/Customer');
const Task = require('../models/Task');
const FieldDefinition = require('../models/FieldDefinition');
const { createNotification, notifyRoles } = require('../services/notificationService');
const { logActivity } = require('../utils/logger');
const { getNextSequenceValue } = require('../utils/counter');
const { hasPermission } = require('../config/permissions');

async function checkEnquiryCompletion(enquiry) {
  try {
    const fields = await FieldDefinition.find({
      formContext: 'Enquiry',
      isDeleted: false,
      isActive: true
    });

    const relevantFields = fields.filter(f => {
      if (!f.productCategory) return true;
      return f.productCategory === enquiry.productCategory;
    });

    let allRequiredFilled = true;
    const missingFields = [];

    for (const field of relevantFields) {
      let isFieldActive = true;
      if (field.conditionalLogic && field.conditionalLogic.dependsOnField) {
        const parentFieldName = field.conditionalLogic.dependsOnField;
        const expectedValue = field.conditionalLogic.requiredValue;

        const actualValue = enquiry.dynamicFields?.[parentFieldName] !== undefined
          ? enquiry.dynamicFields[parentFieldName]
          : enquiry[parentFieldName];

        if (String(actualValue) !== String(expectedValue)) {
          isFieldActive = false;
        }
      }

      if (isFieldActive && field.isRequired) {
        if (enquiry.products && enquiry.products.length > 0) {
          // If the field belongs to a specific product category
          if (field.productCategory) {
            // Check if any product of this category is missing the field
            for (const prod of enquiry.products) {
              const prodCat = prod.category || enquiry.productCategory;
              if (prodCat === field.productCategory) {
                const val = prod.dynamicFields?.[field.fieldName];
                const isFilled = val !== undefined && val !== null && val !== '' && (!Array.isArray(val) || val.length > 0);
                if (!isFilled) {
                  allRequiredFilled = false;
                  if (!missingFields.some(f => f.fieldName === field.fieldName)) {
                    missingFields.push(field);
                  }
                }
              }
            }
          } else {
            // Root-level required field
            const val = enquiry.dynamicFields?.[field.fieldName];
            const isFilled = val !== undefined && val !== null && val !== '' && (!Array.isArray(val) || val.length > 0);
            if (!isFilled) {
              allRequiredFilled = false;
              missingFields.push(field);
            }
          }
        } else {
          // Single product fallback
          const val = enquiry.dynamicFields?.[field.fieldName];
          const isFilled = val !== undefined && val !== null && val !== '' && (!Array.isArray(val) || val.length > 0);
          if (!isFilled) {
            allRequiredFilled = false;
            missingFields.push(field);
          }
        }
      }
    }

    return {
      isComplete: allRequiredFilled,
      missingFields
    };
  } catch (err) {
    console.error('Error in checkEnquiryCompletion:', err.message);
    return { isComplete: false, missingFields: [] };
  }
}

exports.checkEnquiryCompletion = checkEnquiryCompletion;


exports.createEnquiry = async (req, res, next) => {
  try {
    const { customerData, enquiryData } = req.body;
    
    // Auto-create or find existing customer
    let customer;
    if (customerData._id) {
      customer = await Customer.findById(customerData._id);
    } else {
      // Auto-generate unique customerId
      customerData.customerId = `CUS-${Date.now().toString().slice(-6)}`;
      customer = await Customer.create(customerData);
    }

    enquiryData.customer = customer._id;
    enquiryData.createdBy = req.user._id;
    enquiryData.assignedTo = enquiryData.assignedTo || req.user._id;
    enquiryData.sourceType = enquiryData.sourceType || 'Manual Entry';
    enquiryData.sourceChannel = enquiryData.sourceChannel || 'Manual Entry';
    
    // Generate sequential ENQ-YYYY-MM-NNNN ID atomically
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `ENQ-${year}-${month}-`;
    const seq = await getNextSequenceValue(prefix);
    enquiryData.enquiryId = `${prefix}${String(seq).padStart(4, '0')}`;
    enquiryData.processingStatus = 'Completed';

    const enquiry = await Enquiry.create(enquiryData);

    await logActivity({
      req,
      action: 'CREATE',
      module: 'ENQUIRY',
      resourceId: enquiry._id,
      resourceName: enquiry.enquiryId,
      newState: enquiry.toObject(),
      details: `Created new enquiry: ${enquiry.enquiryId}`
    });

    if (enquiry.assignedTo) {
      // 1. Notify the user
      if (enquiry.assignedTo.toString() !== req.user._id.toString()) {
        await createNotification({ 
          user_id: enquiry.assignedTo, 
          type: 'ENQUIRY_ASSIGNED', 
          title: 'New Enquiry Assigned', 
          message: `Enquiry ${enquiry.enquiryId} has been assigned to you.`, 
          related_id: enquiry._id 
        });
      }

      // 2. System-generated Task
      const due = new Date();
      due.setDate(due.getDate() + 1); // Due tomorrow
      await Task.create({
        title: `Follow up on New Enquiry ${enquiry.enquiryId}`,
        description: `System generated task to review and contact the customer regarding ${enquiry.productCategory}.`,
        dueDate: due,
        priority: 'High',
        status: 'To Do',
        assignedTo: enquiry.assignedTo,
        createdBy: req.user._id,
        linkedEnquiry: enquiry._id
      });
    }

    // 3. SOW 5.4 — Urgent priority: immediate alert to Director + Sales Head
    if (enquiry.priority === 'Urgent') {
      await notifyRoles({
        roles: ['DIR', 'DIRECTOR', 'SALES'],
        type: 'URGENT_LEAD',
        title: '🚨 Urgent Lead Alert',
        message: `Urgent enquiry ${enquiry.enquiryId} — ${customer.companyName} — ${enquiry.productCategory}. Immediate action required.`,
        related_id: enquiry._id
      });
    }

    // Check completeness and auto-promote to 'Confirmed'
    const completion = await checkEnquiryCompletion(enquiry);
    if (completion.isComplete && ['New', 'Contacted'].includes(enquiry.status)) {
      enquiry.status = 'Confirmed';
      await enquiry.save();
    }

    // Send automated email if contactEmail is present
    if (enquiry.contactEmail) {
      try {
        const emailBotService = require('../services/emailBotService');
        const unifiedEnquiriesData = [{
          enquiryId: enquiry.enquiryId,
          productDescription: enquiry.productDescription,
          productCategory: enquiry.productCategory,
          quantity: enquiry.quantity,
          unit: enquiry.unit || 'NOS',
          status: enquiry.status,
          missingFields: completion.missingFields,
          products: enquiry.products || [],
          dynamicFields: enquiry.dynamicFields || {}
        }];
        await emailBotService.sendAutomatedRepliesUnified(
          enquiry.contactEmail,
          enquiry.contactPerson || 'Customer',
          unifiedEnquiriesData
        );
      } catch (emailErr) {
        console.error('[Enquiry Controller] Failed to send automated reply for manual enquiry:', emailErr.message);
      }
    }

    res.status(201).json({ status: 'success', data: { enquiry, customer } });
  } catch (err) {
    next(err);
  }
};

exports.getEnquiries = async (req, res, next) => {
  try {
    const enquiries = await Enquiry.find()
      .populate('customer', 'companyName primaryContactName mobileNumber')
      .populate('assignedTo', 'fullName')
      .populate('files')
      .sort('-createdAt');
    res.status(200).json({ status: 'success', results: enquiries.length, data: { enquiries } });
  } catch (err) {
    next(err);
  }
};

exports.getEnquiry = async (req, res, next) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id)
      .populate('customer')
      .populate('assignedTo', 'fullName')
      .populate('createdBy', 'fullName')
      .populate('files')
      .populate('attachmentsList')
      .populate('reviewHistory.reviewedBy', 'fullName');
    
    if (!enquiry) return res.status(404).json({ status: 'error', message: 'Enquiry not found' });
    res.status(200).json({ status: 'success', data: { enquiry } });
  } catch (err) {
    next(err);
  }
};

exports.updateEnquiry = async (req, res, next) => {
  try {
    req.body.lastModifiedBy = req.user._id;

    // Sanitize empty string ObjectIds to null to prevent BSONError
    ['assignedTo', 'customer', 'createdBy', 'lastModifiedBy'].forEach(f => {
      if (req.body[f] === '' || req.body[f] === 'null' || req.body[f] === 'undefined') {
        req.body[f] = null;
      }
    });

    const originalEnquiry = await Enquiry.findById(req.params.id);
    if (!originalEnquiry) {
      return res.status(404).json({ status: 'error', message: 'Enquiry not found' });
    }

    // Guard assignment
    if (req.body.assignedTo !== undefined && req.body.assignedTo?.toString() !== originalEnquiry.assignedTo?.toString()) {
      if (!hasPermission(req.user, 'Enquiry', 'assign')) {
        return res.status(403).json({
          status: 'error',
          message: 'Not authorized to assign enquiries to users'
        });
      }
    }

    // Combine dynamicFields with existing to prevent wiping out unprovided keys
    if (req.body.dynamicFields) {
      // Learning Engine Hook: Record user corrections for dictionary learning
      try {
        const LearningEngine = require('../services/extraction/LearningEngine');
        const oldFields = originalEnquiry.dynamicFields || {};
        const newFields = req.body.dynamicFields;

        for (const [key, newVal] of Object.entries(newFields)) {
          const oldVal = oldFields[key];
          if (newVal && oldVal && String(newVal).trim() !== String(oldVal).trim()) {
            let fieldCategory = 'valve';
            const lKey = key.toLowerCase();
            if (lKey.includes('size')) fieldCategory = 'size';
            else if (lKey.includes('class')) fieldCategory = 'class';
            else if (lKey.includes('material') || lKey.includes('moc')) fieldCategory = 'material';
            else if (lKey.includes('end') || lKey.includes('connection')) fieldCategory = 'connection';

            LearningEngine.recordCorrection({
              enquiryId: originalEnquiry._id,
              productIndex: 0,
              fieldCategory,
              field: key,
              wrongValue: String(oldVal).trim(),
              correctValue: String(newVal).trim(),
              correctedBy: req.user._id,
              documentContext: originalEnquiry.productDescription || ''
            }).catch(err => console.error('[LearningEngine] Correction record error:', err.message));
          }
        }
      } catch (lErr) {
        console.error('[LearningEngine] Error in updateEnquiry hook:', lErr.message);
      }

      req.body.dynamicFields = { ...originalEnquiry.dynamicFields, ...req.body.dynamicFields };
    }

    // Update attached Customer document if customerData is provided
    if (req.body.customerData) {
      const Customer = require('../models/Customer');
      let customerId = originalEnquiry.customer;
      if (customerId) {
        await Customer.findByIdAndUpdate(customerId, req.body.customerData, { runValidators: true });
      } else {
        const newCust = await Customer.create(req.body.customerData);
        req.body.customer = newCust._id;
      }
    }

    let enquiry = await Enquiry.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('customer')
      .populate('assignedTo', 'fullName')
      .populate('createdBy', 'fullName')
      .populate('files')
      .populate('attachmentsList');

    // Auto-promote status to 'Confirmed' if all required fields are complete
    const completion = await checkEnquiryCompletion(enquiry);
    if (completion.isComplete && ['New', 'Contacted'].includes(enquiry.status)) {
      enquiry.status = 'Confirmed';
      enquiry = await enquiry.save();

      if (enquiry.assignedTo) {
        await createNotification({ 
          user_id: enquiry.assignedTo, 
          type: 'SYSTEM', 
          title: '🎉 Enquiry Confirmed', 
          message: `Enquiry ${enquiry.enquiryId} has all required fields completed and is now Confirmed!`, 
          related_id: enquiry._id 
        });
      }
    }

    await logActivity({
      req,
      action: 'UPDATE',
      module: 'ENQUIRY',
      resourceId: enquiry._id,
      resourceName: enquiry.enquiryId,
      previousState: originalEnquiry.toObject(),
      newState: enquiry.toObject(),
      details: `Updated enquiry: ${enquiry.enquiryId}`
    });

    if (req.body.assignedTo && req.body.assignedTo.toString() !== originalEnquiry.assignedTo?.toString()) {
      await createNotification({ 
        user_id: req.body.assignedTo, 
        type: 'ENQUIRY_ASSIGNED', 
        title: 'Enquiry Reassigned', 
        message: `Enquiry ${enquiry.enquiryId} was assigned to you.`, 
        related_id: enquiry._id 
      });
    }

    if (req.body.status && req.body.status !== originalEnquiry.status && enquiry.assignedTo) {
      // Notify the assigned user of status change if they didn't make it
      if (enquiry.assignedTo.toString() !== req.user._id.toString()) {
        await createNotification({ 
          user_id: enquiry.assignedTo, 
          type: 'SYSTEM', 
          title: 'Enquiry Status Changed', 
          message: `Enquiry ${enquiry.enquiryId} is now ${req.body.status}.`, 
          related_id: enquiry._id 
        });
      }

      // SOW 5.4 — Status changed to Lost → notify Director + Sales Head with reason
      if (req.body.status === 'Lost') {
        await notifyRoles({
          roles: ['DIR', 'DIRECTOR', 'SALES'],
          type: 'ENQUIRY_LOST',
          title: 'Enquiry Marked Lost',
          message: `Enquiry ${enquiry.enquiryId} was lost. Reason: ${enquiry.lostReason || 'Not specified'}.`,
          related_id: enquiry._id
        });
      }
    }

    // SOW 5.4 — Priority changed to Urgent
    if (req.body.priority === 'Urgent' && originalEnquiry.priority !== 'Urgent') {
      await notifyRoles({
        roles: ['DIR', 'DIRECTOR', 'SALES'],
        type: 'URGENT_LEAD',
        title: '🚨 Priority Escalated to Urgent',
        message: `Enquiry ${enquiry.enquiryId} escalated to URGENT. Immediate action required.`,
        related_id: enquiry._id
      });
    }

    const populatedEnquiry = await Enquiry.findById(enquiry._id)
      .populate('customer')
      .populate('assignedTo', 'fullName')
      .populate('createdBy', 'fullName')
      .populate('files')
      .populate('attachmentsList')
      .populate('reviewHistory.reviewedBy', 'fullName');

    res.status(200).json({ status: 'success', data: { enquiry: populatedEnquiry } });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/enquiries/:id
exports.deleteEnquiry = async (req, res, next) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ status: 'fail', message: 'Enquiry not found' });
    }

    await Enquiry.findByIdAndDelete(req.params.id);

    await logActivity({
      req,
      action: 'DELETE',
      module: 'ENQUIRY',
      resourceId: enquiry._id,
      resourceName: enquiry.enquiryId,
      previousState: enquiry.toObject(),
      newState: null,
      details: `Permanently deleted enquiry: ${enquiry.enquiryId}`
    });

    res.status(200).json({ status: 'success', message: 'Enquiry deleted' });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/enquiries/:id/verify-approve
exports.verifyAndApproveEnquiry = async (req, res, next) => {
  try {
    const { updatedFields, reviewNotes } = req.body;
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ status: 'error', message: 'Enquiry not found' });
    }

    // Capture changes to record in reviewHistory
    const oldValues = {};
    const newValues = {};

    // First build temporary updated enquiry object to validate
    const tempEnquiry = enquiry.toObject();

    if (updatedFields) {
      for (const key of Object.keys(updatedFields)) {
        if (key === 'dynamicFields') {
          tempEnquiry.dynamicFields = { ...tempEnquiry.dynamicFields, ...updatedFields.dynamicFields };
        } else {
          if (Enquiry.schema.paths[key]) {
            tempEnquiry[key] = updatedFields[key];
          } else {
            if (!tempEnquiry.dynamicFields) tempEnquiry.dynamicFields = {};
            tempEnquiry.dynamicFields[key] = updatedFields[key];
          }
        }
      }
    }

    // Validate required fields based on category
    const fields = await FieldDefinition.find({
      formContext: 'Enquiry',
      isDeleted: false,
      isActive: true
    });

    const relevantFields = fields.filter(f => {
      if (!f.productCategory) return true;
      return f.productCategory === tempEnquiry.productCategory;
    });

    const missingFields = [];
    for (const field of relevantFields) {
      let isFieldActive = true;
      if (field.conditionalLogic && field.conditionalLogic.dependsOnField) {
        const parentFieldName = field.conditionalLogic.dependsOnField;
        const expectedValue = field.conditionalLogic.requiredValue;
        const actualValue = tempEnquiry.dynamicFields?.[parentFieldName] !== undefined
          ? tempEnquiry.dynamicFields[parentFieldName]
          : tempEnquiry[parentFieldName];

        if (String(actualValue) !== String(expectedValue)) {
          isFieldActive = false;
        }
      }

      if (isFieldActive && field.isRequired) {
        // Skip category-specific required fields for multi-product enquiries (specs are item-specific)
        if (tempEnquiry.products && tempEnquiry.products.length > 1 && field.productCategory) {
          continue;
        }
        const val = tempEnquiry.dynamicFields?.[field.fieldName];
        const isFilled = val !== undefined && val !== null && val !== '' && (!Array.isArray(val) || val.length > 0);
        if (!isFilled) {
          missingFields.push(field.fieldLabel);
        }
      }
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Verification failed. The following required fields for category '${tempEnquiry.productCategory}' are missing: ${missingFields.join(', ')}`
      });
    }

    // If validation passes, apply values to the original enquiry instance
    if (updatedFields) {
      for (const key of Object.keys(updatedFields)) {
        if (key === 'dynamicFields') {
          oldValues.dynamicFields = { ...enquiry.dynamicFields };
          newValues.dynamicFields = { ...updatedFields.dynamicFields };
          enquiry.dynamicFields = { ...enquiry.dynamicFields, ...updatedFields.dynamicFields };
        } else {
          const oldVal = enquiry.dynamicFields?.[key] !== undefined ? enquiry.dynamicFields[key] : enquiry[key];
          oldValues[key] = oldVal;
          newValues[key] = updatedFields[key];

          if (Enquiry.schema.paths[key]) {
            enquiry[key] = updatedFields[key];
          } else {
            if (!enquiry.dynamicFields) enquiry.dynamicFields = {};
            enquiry.dynamicFields[key] = updatedFields[key];
          }
        }
      }
    }

    // Record the audit trace in reviewHistory
    enquiry.reviewHistory.push({
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
      oldValues,
      newValues,
      reviewNotes: reviewNotes || 'Manually verified and approved',
      confidenceBefore: enquiry.extractionConfidence || enquiry.aiConfidence || 0,
      confidenceAfter: 100 // Fully human-verified
    });

    // Mark as verified
    enquiry.isUnverified = false;
    enquiry.status = 'Confirmed';
    enquiry.lastModifiedBy = req.user._id;

    // Save Enquiry
    enquiry.markModified('dynamicFields');
    const savedEnquiry = await enquiry.save();

    const populatedEnquiry = await Enquiry.findById(savedEnquiry._id)
      .populate('customer')
      .populate('assignedTo', 'fullName')
      .populate('createdBy', 'fullName')
      .populate('files')
      .populate('attachmentsList')
      .populate('reviewHistory.reviewedBy', 'fullName');

    // Log activity
    await logActivity({
      req,
      action: 'UPDATE',
      module: 'ENQUIRY',
      resourceId: populatedEnquiry._id,
      resourceName: populatedEnquiry.enquiryId,
      details: `Enquiry verified and approved: ${populatedEnquiry.enquiryId}. Notes: ${reviewNotes || 'none'}`
    });

    // Log VerificationCompletionRate metric
    const Metrics = require('../models/Metrics');
    await Metrics.create({
      metricName: 'VerificationCompletionRate',
      value: 1,
      metadata: { enquiryId: populatedEnquiry._id }
    }).catch(err => console.error('[Enquiry Controller] Failed to log verification metric:', err.message));

    res.status(200).json({ status: 'success', data: { enquiry: populatedEnquiry } });
  } catch (err) {
    next(err);
  }
};

// GET /api/enquiries/:id/thread-emails
exports.getEnquiryThreadEmails = async (req, res, next) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ status: 'error', message: 'Enquiry not found' });
    }

    if (!enquiry.threadId) {
      return res.status(200).json({ status: 'success', results: 0, data: { emails: [] } });
    }

    const EmailMessage = require('../models/EmailMessage');
    const emails = await EmailMessage.find({ threadId: enquiry.threadId })
      .populate('attachments')
      .sort({ receivedAt: 1 });

    res.status(200).json({ status: 'success', results: emails.length, data: { emails } });
  } catch (err) {
    next(err);
  }
};

// POST /api/enquiries/suggest-fields
exports.suggestEnquiryFields = async (req, res, next) => {
  try {
    const { customerId, mobileNumber, emailAddress, productCategory, productDescription } = req.body;

    if (!productCategory || !productDescription) {
      return res.status(400).json({ status: 'error', message: 'Product category and description are required.' });
    }

    // Find customer based on ID, mobile, or email
    let customer = null;
    if (customerId) {
      customer = await Customer.findById(customerId);
    } else if (mobileNumber) {
      customer = await Customer.findOne({ mobileNumber });
    } else if (emailAddress) {
      customer = await Customer.findOne({ emailAddress: emailAddress.toLowerCase() });
    }

    let customerHistory = [];
    if (customer) {
      customerHistory = await Enquiry.find({ customer: customer._id })
        .select('productCategory productDescription quantity unit standardCode specialRequirements priority dynamicFields')
        .sort({ createdAt: -1 })
        .limit(10);
    }

    const aiService = require('../services/aiService');
    const suggestionResult = await aiService.suggestEnquiryFields(productCategory, productDescription, customerHistory);

    res.status(200).json({
      status: 'success',
      data: suggestionResult
    });
  } catch (err) {
    next(err);
  }
};

exports.importTender = async (req, res, next) => {
  try {
    // Support both plural (new) and singular (backward compat) field names
    const boqFileList = [
      ...(req.files?.boqFiles || []),
      ...(req.files?.boqFile || [])
    ];
    const specFileList = [
      ...(req.files?.specFiles || []),
      ...(req.files?.specFile || [])
    ];

    if (boqFileList.length === 0 && specFileList.length === 0) {
      return res.status(400).json({ status: 'fail', message: 'Please upload at least a BOQ file or a Specification PDF file.' });
    }

    console.log(`[Tender Import] Received ${boqFileList.length} BOQ file(s) and ${specFileList.length} spec file(s)`);

    let products = [];
    let parsedText = '';

    // Category detection helper — simple keyword-based classification for BOQ rows
    const detectProductCategory = (desc) => {
      const d = (desc || '').toLowerCase();
      if (/vessel|reactor|column|drum|tank|autoclave/i.test(d)) return 'Pressure Vessel';
      if (/exchanger|cooler|condenser|reboiler|heater/i.test(d)) return 'Heat Exchanger';
      if (/tank|silo|hopper|storage/i.test(d)) return 'Storage Tank';
      if (/beam|channel|angle|plate|structural/i.test(d)) return 'Structural';
      return 'Valves';
    };

    // ── 1. Process ALL BOQ Files (XLSX, XLS, CSV) ──────────────────────────
    if (boqFileList.length > 0) {
      const XLSX = require('xlsx');

      for (const boqFile of boqFileList) {
        console.log(`[Tender Import] Parsing BOQ: ${boqFile.originalname} (${boqFile.size} bytes)`);
        const workbook = XLSX.read(boqFile.buffer, { type: 'buffer' });

        // Process ALL sheets in the workbook (some tenders split items across sheets)
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet);
          if (rows.length === 0) continue;

          const sheetProducts = rows.map((row, index) => {
            const titleKey = Object.keys(row).find(k => /title|name|product/i.test(k)) || Object.keys(row).find(k => /item/i.test(k) && !/number|no|qty/i.test(k));
            const descKey = Object.keys(row).find(k => /desc/i.test(k) || /specification/i.test(k));
            const qtyKey = Object.keys(row).find(k => /qty|quantity/i.test(k));
            const unitKey = Object.keys(row).find(k => /unit|uom/i.test(k));

            const title = titleKey ? String(row[titleKey]).trim() : '';
            const desc = descKey ? String(row[descKey]).trim() : '';
            const fullDesc = title && desc ? `${title}: ${desc}` : title || desc || `Item ${index + 1}`;

            // Skip rows that look like headers or empty rows
            if (!title && !desc) return null;

            let quantity = qtyKey ? Number(row[qtyKey]) : 1;
            if (isNaN(quantity)) quantity = 1;

            const boqParserService = require('../services/boqParserService');
            const unit = unitKey ? boqParserService.normalizeUnit(row[unitKey]) : 'NOS';

            return {
              description: fullDesc,
              quantity,
              unit,
              category: detectProductCategory(fullDesc),
              dynamicFields: {}
            };
          }).filter(Boolean);

          products.push(...sheetProducts);
          console.log(`[Tender Import] Sheet "${sheetName}" in ${boqFile.originalname}: ${sheetProducts.length} product(s) extracted`);
        }
      }

      // Do NOT merge products from structured BOQ files to preserve all separate items
      console.log(`[Tender Import] Preserved ${products.length} separate items from BOQ files.`);
    }

    // ── 2. Process ALL Technical Specification files ────────────────────────
    if (specFileList.length > 0) {
      const fileParsingService = require('../services/fileParsingService');
      const textParts = [];

      for (const specFile of specFileList) {
        console.log(`[Tender Import] Parsing spec file: ${specFile.originalname} (${specFile.size} bytes, type: ${specFile.mimetype})`);
        const parseResult = await fileParsingService.extractTextFromFile(specFile.buffer, specFile.mimetype, specFile.originalname);

        if (parseResult.status === 'SUCCESS' && parseResult.text?.trim().length > 0) {
          textParts.push(`\n\n--- Specification Document: ${specFile.originalname} ---\n${parseResult.text}`);
          console.log(`[Tender Import] Extracted ${parseResult.text.length} chars from ${specFile.originalname}`);
        } else {
          console.warn(`[Tender Import] Spec file ${specFile.originalname} extraction status: ${parseResult.status}`);
        }
      }

      // Concatenate all spec texts into a single context
      parsedText = textParts.join('');

      if (parsedText.length > 0 && products.length > 0) {
        const aiService = require('../services/aiService');
        const aiConfig = require('../config/aiConfig');

        const mapLimit = async (items, limit, fn) => {
          const results = [];
          const executing = new Set();
          for (const item of items) {
            const p = Promise.resolve().then(() => fn(item));
            results.push(p);
            executing.add(p);
            const clean = () => executing.delete(p);
            p.then(clean, clean);
            if (executing.size >= limit) {
              await Promise.race(executing);
            }
          }
          return Promise.all(results);
        };

        // Extract dynamic fields for EACH product using its own category concurrently
        await mapLimit(products, aiConfig.MAX_AI_CONCURRENCY, async (prod) => {
          const prodFields = await FieldDefinition.find({
            productCategory: prod.category,
            formContext: 'Enquiry',
            isDeleted: false,
            isActive: true
          });
          if (prodFields.length > 0) {
            prod.dynamicFields = await aiService.extractDynamicFields(
              parsedText,
              prodFields,
              prod.description,
              'NEW_TENDER'
            );
          }
        });
      } else if (parsedText.length > 0 && products.length === 0) {
        // No BOQ Excel uploaded, just spec PDFs — extract actual line items using ExtractionPipeline & layout parser
        const extractionPipeline = require('../services/extraction/ExtractionPipeline');
        const documentLayoutEngine = require('../services/extraction/DocumentLayoutEngine');
        const layout = documentLayoutEngine.parseLayout(parsedText, 'SPEC_IMPORT');

        // Extract line blocks from pages
        const rawLines = parsedText
          .split(/\r?\n/)
          .map(l => l.trim())
          .filter(l => l.length > 5 && /\b(valve|gate|ball|globe|check|butterfly|plug|pipe|flange)\b/i.test(l));

        const fields = await FieldDefinition.find({
          productCategory: 'Valves',
          formContext: 'Enquiry',
          isDeleted: false,
          isActive: true
        });

        if (rawLines.length > 0) {
          for (let i = 0; i < rawLines.length; i++) {
            const lineText = rawLines[i];
            const gatedResult = await extractionPipeline.processProductGatedPipeline({
              textContext: lineText,
              fieldDefinitions: fields,
              productDescription: lineText,
              enquiryId: null,
              productIndex: i
            });
            products.push({
              description: lineText,
              quantity: 1,
              unit: 'NOS',
              category: 'Valves',
              dynamicFields: gatedResult.validatedDynamicFields,
              fieldConfidences: gatedResult.fieldConfidences,
              extractionStatus: gatedResult.extractionStatus
            });
          }
        } else {
          // Single product block fallback
          const gatedResult = await extractionPipeline.processProductGatedPipeline({
            textContext: parsedText,
            fieldDefinitions: fields,
            productDescription: parsedText.substring(0, 100),
            enquiryId: null,
            productIndex: 0
          });
          products = [{
            description: parsedText.substring(0, 200).trim(),
            quantity: 1,
            unit: 'NOS',
            category: 'Valves',
            dynamicFields: gatedResult.validatedDynamicFields,
            fieldConfidences: gatedResult.fieldConfidences,
            extractionStatus: gatedResult.extractionStatus
          }];
        }
      }
    }

    // ── 3. Extract Tender Intelligence (For auto-populating form fields) ────
    let tenderIntelligence = null;
    const fullTextContext = parsedText + '\n\n' + products.map(p => p.description).join('\n');
    if (fullTextContext.trim().length > 50) {
      try {
        const tenderIntelligenceService = require('../services/tenderIntelligenceService');
        const allFiles = [...boqFileList, ...specFileList];
        const fileNames = allFiles.map(f => f.originalname).filter(Boolean);
        console.log(`[Tender Import] Extracting Tender Intelligence...`);
        tenderIntelligence = await tenderIntelligenceService.extractTenderIntelligence(fullTextContext, fileNames, 'IMPORT_TENDER');
      } catch (tiErr) {
        console.error(`[Tender Import] Tender Intelligence extraction failed:`, tiErr.message);
      }
    }

    res.status(200).json({
      status: 'success',
      data: {
        products,
        tenderIntelligence,
        specifications: {},
        filesSummary: {
          boqFiles: boqFileList.map(f => f.originalname),
          specFiles: specFileList.map(f => f.originalname)
        },
        textSnippet: parsedText ? parsedText.substring(0, 500) : ''
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Granular Endpoint: Updates only the line items (products) array of an enquiry.
 * Triggered by the inline editable spreadsheet table in EnquiryDetail UI.
 */
exports.updateEnquiryProducts = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { products } = req.body;

    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ status: 'error', message: 'products array is required' });
    }

    const enquiry = await Enquiry.findById(id);
    if (!enquiry) {
      return res.status(404).json({ status: 'error', message: 'Enquiry not found' });
    }

    // Learning Engine Hook: Record user manual corrections for dynamic dictionary training
    try {
      const LearningEngine = require('../services/extraction/LearningEngine');
      const oldProducts = enquiry.products || [];

      products.forEach((newProd, idx) => {
        const oldProd = oldProducts[idx] || {};
        const oldFields = oldProd.dynamicFields || {};
        const newFields = newProd.dynamicFields || {};

        for (const [key, newVal] of Object.entries(newFields)) {
          const oldVal = oldFields[key];
          if (newVal && oldVal && String(newVal).trim() !== String(oldVal).trim()) {
            let fieldCategory = 'valve';
            const lKey = key.toLowerCase();
            if (lKey.includes('size')) fieldCategory = 'size';
            else if (lKey.includes('class')) fieldCategory = 'class';
            else if (lKey.includes('material') || lKey.includes('moc')) fieldCategory = 'material';
            else if (lKey.includes('end') || lKey.includes('connection')) fieldCategory = 'connection';

            LearningEngine.recordCorrection({
              enquiryId: enquiry._id,
              productIndex: idx,
              fieldCategory,
              field: key,
              wrongValue: String(oldVal).trim(),
              correctValue: String(newVal).trim(),
              correctedBy: req.user?._id || null,
              documentContext: newProd.description || ''
            }).catch(err => console.error('[LearningEngine] Correction record error:', err.message));
          }
        }
      });
    } catch (lErr) {
      console.error('[LearningEngine] Error in updateEnquiryProducts hook:', lErr.message);
    }

    enquiry.products = products;
    enquiry.lastModifiedBy = req.user?._id;
    enquiry.markModified('products');

    const updatedEnquiry = await enquiry.save();

    await logActivity({
      req,
      action: 'UPDATE_LINE_ITEMS',
      module: 'ENQUIRY',
      resourceId: updatedEnquiry._id,
      resourceName: updatedEnquiry.enquiryId,
      details: `Updated ${products.length} line item(s) on enquiry ${updatedEnquiry.enquiryId}`
    });

    res.status(200).json({
      status: 'success',
      message: 'Line items updated successfully',
      data: { enquiry: updatedEnquiry }
    });
  } catch (err) {
    next(err);
  }
};

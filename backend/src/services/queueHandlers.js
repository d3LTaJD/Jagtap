const mongoose = require('mongoose');
const QueueJob = require('../models/QueueJob');
const SystemAuditLog = require('../models/SystemAuditLog');
const EmailMessage = require('../models/EmailMessage');
const Attachment = require('../models/Attachment');
const Enquiry = require('../models/Enquiry');
const Customer = require('../models/Customer');
const User = require('../models/User');
const Task = require('../models/Task');
const FollowUp = require('../models/FollowUp');
const FieldDefinition = require('../models/FieldDefinition');
const aiService = require('./aiService');
const fileParsingService = require('./fileParsingService');
const { getFileBuffer } = require('./localStorageService');
const { createNotification } = require('./notificationService');
const { getNextSequenceValue } = require('../utils/counter');
const { checkEnquiryCompletion } = require('../controllers/enquiryController');
const { Queue } = require('./queueService');

// Instantiate sub-queues
const emailProcessingQueue = new Queue('EmailProcessingQueue');
const ocrProcessingQueue = new Queue('OCRProcessingQueue');
const documentParsingQueue = new Queue('DocumentParsingQueue');
const aiExtractionQueue = new Queue('AIExtractionQueue');
const confidenceCalculationQueue = new Queue('ConfidenceCalculationQueue');
const notificationQueue = new Queue('NotificationQueue');
const attachmentReprocessingQueue = new Queue('AttachmentReprocessingQueue');

/**
 * Checks if all attachments linked to an EmailMessage have completed background processing.
 * If yes, advances the message to AIExtractionQueue.
 */
async function checkAttachmentsCompletion(emailMessageId) {
  const emailMsg = await EmailMessage.findById(emailMessageId);
  if (!emailMsg) return;

  const totalAttachments = emailMsg.attachments.length;
  if (totalAttachments === 0) {
    await aiExtractionQueue.add({ emailMessageId });
    return;
  }

  const completedAttachments = await Attachment.countDocuments({
    _id: { $in: emailMsg.attachments },
    processingStatus: { $in: ['Completed', 'Failed'] }
  });

  if (completedAttachments === totalAttachments) {
    console.log(`[Queue Handlers] All ${totalAttachments} attachments for EmailMessage ${emailMessageId} processed. Queuing AI extraction.`);
    await aiExtractionQueue.add({ emailMessageId });
  }
}

/**
 * 1. EmailProcessingQueue Handler
 */
async function handleEmailProcessing({ emailMessageId }) {
  const emailMsg = await EmailMessage.findById(emailMessageId);
  if (!emailMsg) throw new Error(`EmailMessage ${emailMessageId} not found`);

  emailMsg.processingStatus = 'Processing';
  emailMsg.processingMessage = 'Parsing and classifying attachments';
  emailMsg.processingStartedAt = new Date();
  await emailMsg.save();

  if (emailMsg.attachments.length === 0) {
    console.log(`[Queue Handlers] Email ${emailMessageId} has no attachments. Advancing directly to AI Extraction.`);
    await aiExtractionQueue.add({ emailMessageId });
    return;
  }

  // Queue up attachment parsing/OCR jobs
  for (const attachmentId of emailMsg.attachments) {
    const att = await Attachment.findById(attachmentId);
    if (!att) continue;

    att.processingStatus = 'Pending';
    await att.save();

    const category = fileParsingService.detectCategory(att.originalFileName);
    const ext = att.originalFileName.split('.').pop().toLowerCase();
    
    // Check if drawing/CAD
    if (category === 'Drawing' || ['dwg', 'dxf', 'step', 'stp', 'iges', 'igs', 'zip'].includes(ext)) {
      att.processingStatus = 'Completed';
      att.extractionStatus = 'NOT_SUPPORTED';
      att.extractedText = '';
      att.processingCompletedAt = new Date();
      await att.save();
      continue;
    }

    // Determine if we need OCR
    const isImage = ['png', 'jpg', 'jpeg', 'tiff', 'tif'].includes(ext) || att.fileType.startsWith('image/');
    if (isImage) {
      await ocrProcessingQueue.add({ attachmentId, emailMessageId });
    } else {
      await documentParsingQueue.add({ attachmentId, emailMessageId });
    }
  }

  // Double check in case all attachments were immediately marked as completed (e.g. drawings)
  await checkAttachmentsCompletion(emailMessageId);
}

/**
 * 2. OCRProcessingQueue Handler
 */
async function handleOCRProcessing({ attachmentId, emailMessageId }) {
  const att = await Attachment.findById(attachmentId);
  if (!att) throw new Error(`Attachment ${attachmentId} not found`);

  att.processingStatus = 'Processing';
  att.processingMessage = 'Running OCR via Tesseract.js';
  att.processingStartedAt = new Date();
  await att.save();

  const buffer = await getFileBuffer(att.storagePath);
  const result = await fileParsingService.extractTextFromFile(buffer, att.fileType, att.originalFileName);

  att.extractedText = result.text;
  att.extractionStatus = result.status;
  att.ocrConfidence = result.confidence;
  att.attachmentCategory = result.category;
  att.processingStatus = 'Completed';
  att.processingCompletedAt = new Date();
  await att.save();

  await SystemAuditLog.create({
    eventType: 'OCR',
    entityType: 'Attachment',
    entityId: att._id,
    action: 'OCR text extraction completed',
    metadata: { fileName: att.originalFileName, confidence: result.confidence }
  });

  if (emailMessageId) {
    await checkAttachmentsCompletion(emailMessageId);
  }
}

/**
 * 3. DocumentParsingQueue Handler
 */
async function handleDocumentParsing({ attachmentId, emailMessageId }) {
  const att = await Attachment.findById(attachmentId);
  if (!att) throw new Error(`Attachment ${attachmentId} not found`);

  att.processingStatus = 'Processing';
  att.processingMessage = 'Parsing document content (PDF/Excel/Word)';
  att.processingStartedAt = new Date();
  await att.save();

  const buffer = await getFileBuffer(att.storagePath);
  const result = await fileParsingService.extractTextFromFile(buffer, att.fileType, att.originalFileName);

  att.extractedText = result.text;
  att.extractionStatus = result.status;
  att.attachmentCategory = result.category;
  att.processingStatus = 'Completed';
  att.processingCompletedAt = new Date();
  await att.save();

  await SystemAuditLog.create({
    eventType: 'FILE_UPLOAD',
    entityType: 'Attachment',
    entityId: att._id,
    action: 'Document text extraction completed',
    metadata: { fileName: att.originalFileName }
  });

  if (emailMessageId) {
    await checkAttachmentsCompletion(emailMessageId);
  }
}

/**
 * 4. AIExtractionQueue Handler
 */
async function handleAIExtraction({ emailMessageId }) {
  const emailMsg = await EmailMessage.findById(emailMessageId).populate('attachments');
  if (!emailMsg) throw new Error(`EmailMessage ${emailMessageId} not found`);

  emailMsg.processingStatus = 'Processing';
  emailMsg.processingMessage = 'Extracting structured entities via AI';
  await emailMsg.save();

  const customer = await Customer.findOne({ emailAddress: emailMsg.sender.toLowerCase() });
  if (!customer) throw new Error(`Customer record for ${emailMsg.sender} not found`);

  // Thread matching
  let matchedEnquiries = [];
  const parentMessageIds = [];
  if (emailMsg.messageId) {
    // Look up references
    const parsed = {
      subject: emailMsg.subject,
      bodyText: emailMsg.bodyText,
      inReplyTo: emailMsg.messageId
    };
    // Match by reference ID in subject/body
    const refMatch = (emailMsg.subject + ' ' + emailMsg.bodyText).match(/ENQ-\d{4}-\d{2}-\d{4}/gi);
    if (refMatch) {
      const matchedIds = [...new Set(refMatch.map(id => id.toUpperCase()))];
      matchedEnquiries = await Enquiry.find({ enquiryId: { $in: matchedIds } }).populate('customer');
    }
  }

  // Fallback to threadId
  if (matchedEnquiries.length === 0 && emailMsg.threadId) {
    matchedEnquiries = await Enquiry.find({ threadId: emailMsg.threadId }).populate('customer');
  }

  // Fallback to customer reply
  if (matchedEnquiries.length === 0) {
    const isReplySubject = /^(re|fwd|fw)\s*:/i.test(emailMsg.subject.trim());
    if (isReplySubject) {
      const activeEnquiries = await Enquiry.find({
        customer: customer._id,
        status: { $in: ['New', 'Contacted', 'Technical Review', 'Needs Review', 'Verified'] }
      }).populate('customer');
      
      if (activeEnquiries.length === 1) {
        matchedEnquiries = [activeEnquiries[0]];
      }
    }
  }

  // Re-fetch attachments fresh from DB — the initial populate captured empty extractedText
  // before DocumentParsingQueue ran. We need the latest extractedText for AI context.
  const freshAttachmentsForAI = await Attachment.find({ _id: { $in: emailMsg.attachments } });
  const bodyText = emailMsg.bodyText || '';
  const savedAttachments = freshAttachmentsForAI;

  if (matchedEnquiries.length > 0) {
    console.log(`[AI Extraction] Identified thread reply for ${matchedEnquiries.length} enquiry(ies).`);
    
    // Set processing status on enquiries
    for (const enq of matchedEnquiries) {
      enq.processingStatus = 'Processing';
      enq.processingMessage = 'Running specification extraction via AI';
      await enq.save();
    }

    await confidenceCalculationQueue.add({
      emailMessageId,
      isReply: true,
      matchedEnquiryIds: matchedEnquiries.map(e => e._id)
    });
  } else {
    // New Enquiry Extraction
    console.log('[AI Extraction] Calling AI extractEnquiries for new requirements...');
    const metadata = { from: emailMsg.sender, subject: emailMsg.subject };
    const extractedResult = await aiService.extractEnquiries(bodyText, savedAttachments, metadata);

    if (extractedResult.isEnquiry === false || !extractedResult.enquiries || extractedResult.enquiries.length === 0) {
      console.log(`[AI Extraction] Email ${emailMessageId} is not an active business enquiry. Terminating.`);
      emailMsg.processingStatus = 'Completed';
      emailMsg.processingMessage = 'Not classified as enquiry';
      emailMsg.processingCompletedAt = new Date();
      await emailMsg.save();
      return;
    }

    // Safety limit check
    const MAX_PRODUCTS_PER_EMAIL = 50;
    if (extractedResult.enquiries.length > MAX_PRODUCTS_PER_EMAIL) {
      const err = new Error(`Email contains ${extractedResult.enquiries.length} products, exceeding safety limit of ${MAX_PRODUCTS_PER_EMAIL}`);
      emailMsg.processingStatus = 'Failed';
      emailMsg.processingMessage = `Safety Limit Exceeded: ${extractedResult.enquiries.length} items`;
      await emailMsg.save();
      throw err;
    }

    // Create temporary enquiries in 'Pending' processingStatus
    const defaultAgent = await User.findOne({ is_active: true, role: { $in: ['SUPER_ADMIN', 'DIRECTOR', 'SA', 'DIR'] } }) || await User.findOne({ is_active: true });
    const agentId = defaultAgent ? defaultAgent._id : null;

    // Update customer company info
    if (extractedResult.companyName && extractedResult.companyName !== 'Individual Customer' && customer.companyName === 'Individual Customer') {
      customer.companyName = extractedResult.companyName;
      customer.primaryContactName = extractedResult.primaryContactName || customer.primaryContactName;
      customer.mobileNumber = extractedResult.mobileNumber !== '0000000000' ? extractedResult.mobileNumber : customer.mobileNumber;
      await customer.save();
    }

    // Map products array
    const productsArray = extractedResult.enquiries.map(item => ({
      description: item.productDescription || '',
      quantity: item.quantity || 1,
      unit: item.unit || 'NOS',
      category: item.productCategory,
      standardCode: item.standardCode,
      confidence: item.confidence
    }));

    // Build merged enquiry fields
    const categories = [...new Set(extractedResult.enquiries.map(item => item.productCategory).filter(Boolean))];
    const mergedCategory = categories.length === 1 ? categories[0] : (categories.length > 1 ? 'Multiple' : 'Multiple');

    const descParts = extractedResult.enquiries.map((item, idx) => `${idx + 1}. ${item.productDescription} (${item.quantity} ${item.unit || 'NOS'})`);
    let mergedDescription = descParts.join(' | ');
    if (mergedDescription.length > 200) {
      mergedDescription = mergedDescription.substring(0, 197) + '...';
    }

    const mergedQuantity = extractedResult.enquiries.reduce((sum, item) => sum + (item.quantity || 0), 0);

    const units = [...new Set(extractedResult.enquiries.map(item => item.unit).filter(Boolean))];
    const mergedUnit = units.length === 1 ? units[0] : 'NOS';

    const standards = [...new Set(extractedResult.enquiries.map(item => item.standardCode).filter(Boolean))];
    const mergedStandard = standards.length === 1 ? standards[0] : 'Not specified';

    const reqs = [...new Set(extractedResult.enquiries.map(item => item.specialRequirements).filter(r => r && r.trim().length > 0))];
    let mergedSpecialRequirements = reqs.join(' | ');
    if (mergedSpecialRequirements.length > 400) {
      mergedSpecialRequirements = mergedSpecialRequirements.substring(0, 397) + '...';
    }

    const priorityRank = { 'Urgent': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
    let maxPriority = 'Medium';
    let maxRank = 0;
    for (const item of extractedResult.enquiries) {
      const r = priorityRank[item.priority] || 2;
      if (r > maxRank) {
        maxRank = r;
        maxPriority = item.priority;
      }
    }
    const mergedPriority = maxPriority;

    const averageConfidence = Math.round(
      extractedResult.enquiries.reduce((sum, item) => sum + (item.confidence || 100), 0) / extractedResult.enquiries.length
    );

    const minConfidence = extractedResult.enquiries.reduce(
      (min, item) => Math.min(min, item.confidence || 100),
      100
    );

    const attachmentNames = [];
    for (const item of extractedResult.enquiries) {
      if (item.linkedAttachmentNames) {
        attachmentNames.push(...item.linkedAttachmentNames);
      }
    }
    const mergedAttachmentNames = [...new Set(attachmentNames)];

    const mergedEnquiryItem = {
      productCategory: mergedCategory,
      productDescription: mergedDescription,
      quantity: mergedQuantity,
      unit: mergedUnit,
      standardCode: mergedStandard,
      specialRequirements: mergedSpecialRequirements,
      priority: mergedPriority,
      confidence: averageConfidence,
      minConfidence: minConfidence,
      linkedAttachmentNames: mergedAttachmentNames,
      products: productsArray
    };

    const enquiriesCreatedIds = [];

    // Idempotency: Prevent duplicate Enquiry creation
    const dupQuery = {
      customer: customer._id,
      $or: []
    };
    if (emailMsg.messageId) {
      dupQuery.$or.push({ originalMessageId: emailMsg.messageId });
    }
    if (emailMsg.sourceEmailId) {
      dupQuery.$or.push({ sourceEmailId: emailMsg.sourceEmailId });
    }
    if (dupQuery.$or.length === 0) {
      delete dupQuery.$or;
      dupQuery.productDescription = mergedDescription;
      dupQuery.quantity = mergedQuantity;
    }

    const existingEnq = await Enquiry.findOne(dupQuery);
    if (existingEnq) {
      console.log(`[AI Extraction] Enquiry ${existingEnq.enquiryId} already exists for "${mergedDescription}". Skipping creation.`);
      enquiriesCreatedIds.push(existingEnq._id);
    } else {
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const prefix = `ENQ-${year}-${month}-`;
      const seq = await getNextSequenceValue(prefix);
      const enquiryId = `${prefix}${String(seq).padStart(4, '0')}`;

      // Create model
      const enquiry = await Enquiry.create({
        enquiryId,
        customer: customer._id,
        sourceChannel: 'Email',
        emailAccount: 'info@',
        contactPerson: customer.primaryContactName,
        contactMobile: customer.mobileNumber,
        contactEmail: emailMsg.sender.toLowerCase(),
        productCategory: mergedEnquiryItem.productCategory,
        productDescription: mergedEnquiryItem.productDescription,
        quantity: mergedEnquiryItem.quantity,
        unit: mergedEnquiryItem.unit,
        standardCode: mergedEnquiryItem.standardCode,
        specialRequirements: mergedEnquiryItem.specialRequirements,
        priority: mergedEnquiryItem.priority,
        assignedTo: agentId,
        createdBy: agentId,
        status: 'New',
        isUnverified: false,
        aiConfidence: mergedEnquiryItem.confidence,
        minConfidence: mergedEnquiryItem.minConfidence,
        products: mergedEnquiryItem.products,
        originalMessageId: emailMsg.messageId,
        sourceEmailId: emailMsg.sourceEmailId || '',
        threadId: emailMsg.threadId,
        processingStatus: 'Pending',
        processingMessage: 'Enquiry document initialized'
      });
      enquiriesCreatedIds.push(enquiry._id);
    }

    // Queue confidence and dynamic fields calculation
    await confidenceCalculationQueue.add({
      emailMessageId,
      isReply: false,
      enquiriesCreatedIds,
      aiExtractionResult: [mergedEnquiryItem]
    });
  }
}

/**
 * 5. ConfidenceCalculationQueue Handler
 */
async function handleConfidenceCalculation({ emailMessageId, isReply, matchedEnquiryIds, enquiriesCreatedIds, aiExtractionResult }) {
  const emailMsg = await EmailMessage.findById(emailMessageId);
  if (!emailMsg) throw new Error(`EmailMessage ${emailMessageId} not found`);

  // Re-fetch attachments fresh from DB to get the latest extractedText
  // (DocumentParsingQueue runs before this and updates extractedText in DB)
  const freshAttachments = await Attachment.find({
    _id: { $in: emailMsg.attachments }
  });

  // Build the unified full text context (email body + all attachment contents)
  let combinedExtractedText = '';
  for (const att of freshAttachments) {
    if (att.extractedText && att.extractedText.trim().length > 0) {
      combinedExtractedText += `\n\n--- Attachment: ${att.originalFileName} ---\n${att.extractedText}\n`;
      console.log(`[Confidence Queue] Including attachment text from "${att.originalFileName}": ${att.extractedText.length} chars`);
    } else {
      console.log(`[Confidence Queue] Attachment "${att.originalFileName}" has no extracted text (status: ${att.extractionStatus})`);
    }
  }
  const fullTextContext = `${emailMsg.bodyText || ''}${combinedExtractedText}`;
  console.log(`[Confidence Queue] Total context for AI: ${fullTextContext.length} chars (body: ${emailMsg.bodyText?.length || 0}, attachments: ${combinedExtractedText.length})`);

  if (isReply) {
    const { stripQuotedText } = require('./emailBotService');
    
    for (const enquiryId of matchedEnquiryIds) {
      const enquiry = await Enquiry.findById(enquiryId);
      if (!enquiry) continue;

      enquiry.processingStatus = 'Processing';
      enquiry.processingMessage = 'Recalculating specifications and confidence';
      await enquiry.save();

      const fields = await FieldDefinition.find({
        formContext: 'Enquiry',
        isDeleted: false,
        isActive: true,
        $or: [
          { productCategory: enquiry.productCategory },
          { productCategory: null },
          { productCategory: '' }
        ]
      });

      // AI dynamic spec extraction
      const extractedFields = await aiService.extractDynamicFields(fullTextContext, fields, enquiry.productDescription);
      
      const updatedFieldsLog = [];
      const previousFields = { ...enquiry.dynamicFields };
      for (const key of Object.keys(extractedFields)) {
        if (extractedFields[key] !== previousFields[key]) {
          const fieldDef = fields.find(f => f.fieldName === key);
          updatedFieldsLog.push(`${fieldDef ? fieldDef.fieldLabel : key}: "${previousFields[key] || 'None'}" → "${extractedFields[key]}"`);
          enquiry.dynamicFields[key] = extractedFields[key];
        }
      }

      // Link attachments bidirectionally using freshAttachments
      if (freshAttachments.length > 0) {
        enquiry.attachmentsList = [...new Set([...(enquiry.attachmentsList || []), ...freshAttachments.map(a => a._id)])];
        for (const att of freshAttachments) {
          if (!att.linkedEnquiries.includes(enquiry._id)) {
            att.linkedEnquiries.push(enquiry._id);
            await att.save();
          }
        }
      }

      // Final confidence calculation (adjusting with OCR confidence if applicable)
      let finalConfidence = enquiry.extractionConfidence || 100;
      const linkedNewAttachments = freshAttachments.filter(att => att.ocrConfidence !== undefined);
      if (linkedNewAttachments.length > 0) {
        const avgOcr = linkedNewAttachments.reduce((sum, att) => sum + att.ocrConfidence, 0) / linkedNewAttachments.length;
        finalConfidence = Math.round((finalConfidence * 0.7) + (avgOcr * 0.3));
      }
      enquiry.extractionConfidence = finalConfidence;

      // Check completeness and promote
      const completion = await checkEnquiryCompletion(enquiry);
      if (completion.isComplete && ['New', 'Contacted', 'Technical Review', 'Verified'].includes(enquiry.status)) {
        enquiry.status = 'Ready for Offer';
      }

      enquiry.processingStatus = 'Completed';
      enquiry.processingCompletedAt = new Date();
      enquiry.markModified('dynamicFields');
      await enquiry.save();

      // Log FollowUp
      const cleanBody = stripQuotedText(emailMsg.bodyText);
      let noteText = `📧 Thread reply processed (Background Queue).\n`;
      if (freshAttachments.length > 0) {
        noteText += `Attachments Received: ${freshAttachments.map(a => `${a.originalFileName} (v${a.versionNumber || 1})`).join(', ')}\n`;
      }
      if (updatedFieldsLog.length > 0) {
        noteText += `Fields Extracted:\n${updatedFieldsLog.map(l => `- ${l}`).join('\n')}\n`;
      }
      noteText += `\nEmail Content:\n${cleanBody || '(No new text)'}`;

      const notesSlice = noteText.slice(0, 2000);
      const existingFollowUp = await FollowUp.findOne({
        enquiry: enquiry._id,
        notes: notesSlice
      });

      if (!existingFollowUp) {
        await FollowUp.create({
          enquiry: enquiry._id,
          type: 'EMAIL',
          notes: notesSlice,
          addedBy: enquiry.assignedTo || enquiry.createdBy || null,
          followUpDate: new Date()
        });
      } else {
        console.log(`[Queue Handlers] Duplicate FollowUp blocked for Enquiry ${enquiry._id}`);
      }

      await SystemAuditLog.create({
        eventType: 'STATUS_TRANSITION',
        entityType: 'Enquiry',
        entityId: enquiry._id,
        action: `Enquiry specifications updated from thread reply. Status: ${enquiry.status}`,
        metadata: { enquiryId: enquiry.enquiryId }
      });
    }

    await notificationQueue.add({
      emailMessageId,
      isReply: true,
      enquiryIds: matchedEnquiryIds
    });

  } else {
    // New Enquiry Calculations
    for (let i = 0; i < enquiriesCreatedIds.length; i++) {
      const enquiryId = enquiriesCreatedIds[i];
      const aiItem = aiExtractionResult[i];
      const enquiry = await Enquiry.findById(enquiryId);
      if (!enquiry) continue;

      enquiry.processingStatus = 'Processing';
      enquiry.processingMessage = 'Mapping specifications and computing confidence';
      await enquiry.save();

      const fields = await FieldDefinition.find({
        formContext: 'Enquiry',
        isDeleted: false,
        isActive: true,
        $or: [
          { productCategory: enquiry.productCategory },
          { productCategory: null },
          { productCategory: '' }
        ]
      });

      const extractedFields = await aiService.extractDynamicFields(fullTextContext, fields, enquiry.productDescription);
      enquiry.dynamicFields = extractedFields;

      // Find attachments mapped by AI — use freshAttachments (full documents, not ObjectIds)
      const mappedAttachments = freshAttachments.filter(att =>
        (aiItem.linkedAttachmentNames || []).some(name =>
          name && att.originalFileName && name.toLowerCase() === att.originalFileName.toLowerCase()
        )
      );
      // If no specific attachment was linked by AI, use all attachments for this enquiry
      const attachmentsToLink = mappedAttachments.length > 0 ? mappedAttachments : freshAttachments;

      // Link attachments bidirectionally
      if (attachmentsToLink.length > 0) {
        enquiry.attachmentsList = attachmentsToLink.map(a => a._id);
        for (const att of attachmentsToLink) {
          if (!att.linkedEnquiries) att.linkedEnquiries = [];
          if (!att.linkedEnquiries.some(id => id.toString() === enquiry._id.toString())) {
            att.linkedEnquiries.push(enquiry._id);
            await att.save();
          }
        }
      }

      // Calculate confidence
      let finalConfidence = aiItem.confidence || 100;
      const ocrLinked = attachmentsToLink.filter(att => att.ocrConfidence !== undefined);
      if (ocrLinked.length > 0) {
        const avgOcr = ocrLinked.reduce((sum, att) => sum + att.ocrConfidence, 0) / ocrLinked.length;
        finalConfidence = Math.round((aiItem.confidence * 0.7) + (avgOcr * 0.3));
      }
      enquiry.extractionConfidence = finalConfidence;

      // Status assignment
      let status = 'New';
      let isUnverified = false;
      if (finalConfidence < 70) {
        status = 'Needs Review';
        isUnverified = true;
        enquiry.status = 'Needs Review';
        enquiry.isUnverified = true;
      }

      // Check completeness
      const completion = await checkEnquiryCompletion(enquiry);
      if (completion.isComplete && status === 'New') {
        enquiry.status = 'Ready for Offer';
        status = 'Ready for Offer';
      }

      enquiry.processingStatus = 'Completed';
      enquiry.processingCompletedAt = new Date();
      enquiry.markModified('dynamicFields');
      await enquiry.save();

      // Create tasks
      if (enquiry.assignedTo) {
        if (isUnverified) {
          await Task.create({
            title: `🔍 Verify Specs: ${enquiry.enquiryId}`,
            description: `Manual verification required for Enquiry ${enquiry.enquiryId} due to low extraction confidence (${finalConfidence}%).`,
            dueDate: new Date(),
            priority: 'High',
            status: 'To Do',
            assignedTo: enquiry.assignedTo,
            createdBy: enquiry.assignedTo,
            linkedEnquiry: enquiry._id
          });
        } else {
          const due = new Date();
          due.setDate(due.getDate() + 1);
          await Task.create({
            title: `Review Email Enquiry ${enquiry.enquiryId}`,
            description: `System task to review and follow up with the customer regarding: ${enquiry.productDescription}.`,
            dueDate: due,
            priority: enquiry.priority === 'Urgent' ? 'High' : 'Medium',
            status: 'To Do',
            assignedTo: enquiry.assignedTo,
            createdBy: enquiry.assignedTo,
            linkedEnquiry: enquiry._id
          });
        }
      }

      await SystemAuditLog.create({
        eventType: 'INGESTION',
        entityType: 'Enquiry',
        entityId: enquiry._id,
        action: `Enquiry generated from background queue pipeline. Status: ${status}`,
        metadata: { enquiryId: enquiry.enquiryId, confidence: finalConfidence }
      });
    }

    await notificationQueue.add({
      emailMessageId,
      isReply: false,
      enquiryIds: enquiriesCreatedIds
    });
  }
}

/**
 * 6. NotificationQueue Handler
 */
async function handleNotificationProcessing({ emailMessageId, isReply, enquiryIds }) {
  const emailMsg = await EmailMessage.findById(emailMessageId);
  if (!emailMsg) throw new Error(`EmailMessage ${emailMessageId} not found`);

  const customer = await Customer.findOne({ emailAddress: emailMsg.sender.toLowerCase() });
  const senderName = customer ? customer.primaryContactName : 'Customer';

  // Gather summary of created/updated enquiries for the customer reply email
  const unifiedEnquiriesData = [];
  for (const enqId of enquiryIds) {
    const enquiry = await Enquiry.findById(enqId);
    if (!enquiry) continue;

    const completion = await checkEnquiryCompletion(enquiry);
    unifiedEnquiriesData.push({
      enquiryId: enquiry.enquiryId,
      productDescription: enquiry.productDescription,
      productCategory: enquiry.productCategory,
      quantity: enquiry.quantity,
      unit: enquiry.unit,
      status: enquiry.status,
      missingFields: completion.missingFields
    });

    // Notify agents
    if (enquiry.assignedTo) {
      if (enquiry.isUnverified) {
        await createNotification({
          user_id: enquiry.assignedTo,
          type: 'SYSTEM',
          title: '🔍 Verification Required',
          message: `Enquiry ${enquiry.enquiryId} requires human review (Confidence: ${enquiry.extractionConfidence}%).`,
          related_id: enquiry._id
        });
      } else if (enquiry.status === 'Ready for Offer') {
        await createNotification({
          user_id: enquiry.assignedTo,
          type: 'SYSTEM',
          title: '✅ Ready for Offer',
          message: `Enquiry ${enquiry.enquiryId} is complete and ready for quotation.`,
          related_id: enquiry._id
        });
      } else {
        await createNotification({
          user_id: enquiry.assignedTo,
          type: 'SYSTEM',
          title: '📩 New Enquiry Ingested',
          message: `New Enquiry ${enquiry.enquiryId} successfully assigned.`,
          related_id: enquiry._id
        });
      }

      // Also trigger new attachment alerts
      if (emailMsg.attachments.length > 0) {
        await createNotification({
          user_id: enquiry.assignedTo,
          type: 'SYSTEM',
          title: '📎 New Attachments Ingested',
          message: `Ingested ${emailMsg.attachments.length} attachment(s) for enquiry ${enquiry.enquiryId}.`,
          related_id: enquiry._id
        });
      }
    }
  }

  // Trigger unified reply email to customer
  const { sendAutomatedRepliesUnified } = require('./emailBotService');
  try {
    await sendAutomatedRepliesUnified(emailMsg.sender, senderName, unifiedEnquiriesData);
  } catch (smtpErr) {
    console.error(`[Notification Queue] Failed to send unified customer reply:`, smtpErr.message);
  }

  emailMsg.processingStatus = 'Completed';
  emailMsg.processingMessage = 'Finished successfully';
  emailMsg.processingCompletedAt = new Date();
  await emailMsg.save();

  console.log(`[Notification Queue] EmailMessage ${emailMessageId} background processing finished.`);
}

/**
 * 7. AttachmentReprocessingQueue Handler (re-run OCR/parsing on existing attachment)
 */
async function handleAttachmentReprocessing({ attachmentId }) {
  const att = await Attachment.findById(attachmentId);
  if (!att) throw new Error(`Attachment ${attachmentId} not found`);

  att.processingStatus = 'Processing';
  att.processingMessage = 'Reprocessing file text content';
  await att.save();

  const buffer = await getFileBuffer(att.storagePath);
  const result = await fileParsingService.extractTextFromFile(buffer, att.fileType, att.originalFileName);

  att.extractedText = result.text;
  att.extractionStatus = result.status;
  if (result.confidence !== undefined) att.ocrConfidence = result.confidence;
  att.processingStatus = 'Completed';
  att.processingCompletedAt = new Date();
  await att.save();

  // Re-run confidence and fields update on linked enquiries
  if (att.linkedEnquiries.length > 0) {
    console.log(`[Reprocessing Queue] Queueing calculations update for ${att.linkedEnquiries.length} linked enquiries.`);
    await confidenceCalculationQueue.add({
      emailMessageId: null,
      isReply: true,
      matchedEnquiryIds: att.linkedEnquiries
    });
  }
}

// Register all background handlers
const { registerHandler: reg } = require('./queueService');

reg('EmailProcessingQueue', handleEmailProcessing);
reg('OCRProcessingQueue', handleOCRProcessing);
reg('DocumentParsingQueue', handleDocumentParsing);
reg('AIExtractionQueue', handleAIExtraction);
reg('ConfidenceCalculationQueue', handleConfidenceCalculation);
reg('NotificationQueue', handleNotificationProcessing);
reg('AttachmentReprocessingQueue', handleAttachmentReprocessing);

module.exports = {
  emailProcessingQueue,
  ocrProcessingQueue,
  documentParsingQueue,
  aiExtractionQueue,
  confidenceCalculationQueue,
  notificationQueue,
  attachmentReprocessingQueue,
  
  // Exported for testing
  handleAIExtraction,
  handleConfidenceCalculation
};

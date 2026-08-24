const Quotation = require('../models/Quotation');
const Enquiry = require('../models/Enquiry');
const puppeteer = require('puppeteer');
const { createNotification, notifyRoles, sendEmail } = require('../services/notificationService');
const { logActivity } = require('../utils/logger');
const { getNextSequenceValue } = require('../utils/counter');
const { hasPermission } = require('../config/permissions');
const { calculateQuotationPricing } = require('../utils/quotationCalculator');

exports.createQuotation = async (req, res, next) => {
  try {
    req.body.enquiry = req.body.enquiry || req.body.enquiryId;
    req.body.customer = req.body.customer || req.body.customerId;
    req.body.preparedBy = req.user._id;
    req.body.createdBy = req.body.createdBy || req.user._id;
    
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `QT-${year}-${month}-`;
    const seq = await getNextSequenceValue(prefix);
    req.body.quotationId = `${prefix}${String(seq).padStart(4, '0')}`;

    // Set standard defaults matching Offer Formates.xlsx
    const defaultManufacturerName = 'M/s. PETRO VALVES PVT LTD';
    const defaultOriginOfGoods = 'INDIA';
    const defaultWeightDimensions = 'This details given at the time of dispatch';
    const defaultTechnicalDocuments = 'This is share after receiving of techno-commercial order';
    const defaultDeliveryTimeHeader = 'Provided in COMMERCIAL PART - III';

    const defaultPriceBasis = 'Ex Works Ahmedabad.';
    const defaultPackingForwardingTerms = 'Extra as given in Price Part - II, If required in wooden box packing & NIL for loose Plastic packing.';
    const defaultFreightTerms = 'Extra at actual to your account.';
    const defaultTaxDutyTerms = 'Extra at actual to your account (18% GST) as given in Price Part - II.';
    const defaultValidityTerms = 'Three Month from the date of Quote';
    const defaultTpiTerms = 'We will offer valves to your nominated TPIA, charges towards TPIA fees will be Extra at actual to your account as given in Price Part - II.';
    const defaultTransitInsurance = 'In your scope only.';
    const defaultGuaranteeTerms = '12 months from the date of commissioning or 18 months from the date of last shipment which ever is earlier.';
    const defaultPaymentTerms = '10% Advance along with PO & 20% with approved QAP & GAD Balance against Performa Invoice prior to dispatch.';
    const defaultDeliverySchedule = '12 weeks as per certification from the date of approval of technical documents and advance payment.';

    let extractedTerms = {};

    if (req.body.enquiry) {
      const Attachment = require('../models/Attachment');
      const EmailMessage = require('../models/EmailMessage');
      const aiService = require('../services/aiService');

      const enquiry = await Enquiry.findById(req.body.enquiry).populate('attachmentsList');
      if (!enquiry) {
        return res.status(404).json({ status: 'error', message: 'Enquiry not found' });
      }
      const BLOCKED_STATUSES = ['Needs Review', 'Lost', 'On Hold', 'Abandoned'];
      if (BLOCKED_STATUSES.includes(enquiry.status)) {
        return res.status(400).json({
          status: 'error',
          message: `Quotation generation is blocked. The associated enquiry is in '${enquiry.status}' status and requires human review or status promotion before creating a quotation.`
        });
      }

      req.body.productCategory = enquiry.productCategory;
      req.body.customer = enquiry.customer;
      req.body.pmcConsultant = req.body.pmcConsultant || enquiry.pmcConsultant;

      // Extract details if it is a Tender OR has attachments
      if (enquiry.sourceType === 'Tender' || (enquiry.attachmentsList && enquiry.attachmentsList.length > 0)) {
        // Build the context text
        let contextText = `Enquiry ID: ${enquiry.enquiryId}\nDescription: ${enquiry.productDescription}\nSpecial Requirements: ${enquiry.specialRequirements}\n`;
        
        // Add attachment parsed text
        if (enquiry.attachmentsList && enquiry.attachmentsList.length > 0) {
          for (const att of enquiry.attachmentsList) {
            if (att.extractedText) {
              contextText += `\n--- Parse of File: ${att.originalFileName} ---\n${att.extractedText}\n`;
            }
          }
        }

        // Add thread emails
        if (enquiry.threadId) {
          const emails = await EmailMessage.find({ threadId: enquiry.threadId });
          for (const email of emails) {
            contextText += `\n--- Email Subject: ${email.subject} ---\n${email.bodyText || ''}\n`;
          }
        }

        // Run AI term extraction
        extractedTerms = await aiService.extractQuotationTerms(contextText).catch(err => {
          console.error('[Quotation Controller] AI term extraction failed:', err.message);
          return {};
        });
      }

      // Copy enquiry scope of supply if not specified
      if (!req.body.scopeOfSupply) {
        req.body.scopeOfSupply = enquiry.productDescription || '';
      }

      // Auto-populate items from enquiry products / emails / attachments if items array is empty or omitted
      if (!req.body.items || !Array.isArray(req.body.items) || req.body.items.length === 0) {
        req.body.items = await extractItemsFromEnquiry(enquiry);
      }

      // Copy enquiry dynamicFields to parent and to each item
      req.body.dynamicFields = { ...enquiry.dynamicFields, ...req.body.dynamicFields };
      if (req.body.items && Array.isArray(req.body.items)) {
        req.body.items.forEach((item, itemIdx) => {
          // Attempt to find matching product in enquiry.products
          let matchedProd = null;
          if (enquiry.products && enquiry.products.length > 0) {
            // First try matching by immutable lineItemId
            if (item.lineItemId || item.enquiryLineItemId) {
              matchedProd = enquiry.products.find(p => p.lineItemId === (item.lineItemId || item.enquiryLineItemId));
            }
            // Next try matching by exact description
            if (!matchedProd && item.description) {
              matchedProd = enquiry.products.find(p => p.description === item.description);
            }
            // Fallback by index only if description matches or no other match found
            if (!matchedProd && enquiry.products[itemIdx]) {
              matchedProd = enquiry.products[itemIdx];
            }
          }
          const prodDynamicFields = matchedProd ? (matchedProd.dynamicFields || {}) : {};
          item.dynamicFields = { ...prodDynamicFields, ...item.dynamicFields };

          // Canonical key synchronization
          if (item.dynamicFields.size && !item.dynamicFields.valve_size) item.dynamicFields.valve_size = item.dynamicFields.size;
          if (item.dynamicFields.size_mm && !item.dynamicFields.valve_size) item.dynamicFields.valve_size = item.dynamicFields.size_mm;
          if (item.dynamicFields.valveSize && !item.dynamicFields.valve_size) item.dynamicFields.valve_size = item.dynamicFields.valveSize;
          if (item.dynamicFields.class && !item.dynamicFields.valve_class) item.dynamicFields.valve_class = item.dynamicFields.class;
          if (item.dynamicFields.pressure_class && !item.dynamicFields.valve_class) item.dynamicFields.valve_class = item.dynamicFields.pressure_class;
          if (item.dynamicFields.valveClass && !item.dynamicFields.valve_class) item.dynamicFields.valve_class = item.dynamicFields.valveClass;
          if (item.dynamicFields.type && !item.dynamicFields.valve_type) item.dynamicFields.valve_type = item.dynamicFields.type;
          if (item.dynamicFields.valveType && !item.dynamicFields.valve_type) item.dynamicFields.valve_type = item.dynamicFields.valveType;
          if (item.dynamicFields.operating && !item.dynamicFields.valve_operating) item.dynamicFields.valve_operating = item.dynamicFields.operating;
          if (item.dynamicFields.operation && !item.dynamicFields.valve_operating) item.dynamicFields.valve_operating = item.dynamicFields.operation;
          if (item.dynamicFields.actuation && !item.dynamicFields.valve_operating) item.dynamicFields.valve_operating = item.dynamicFields.actuation;
          if (item.dynamicFields.end_connection && !item.dynamicFields.valve_end_connection) item.dynamicFields.valve_end_connection = item.dynamicFields.end_connection;
          if (item.dynamicFields.endConnection && !item.dynamicFields.valve_end_connection) item.dynamicFields.valve_end_connection = item.dynamicFields.endConnection;
          if (item.dynamicFields.moc && !item.dynamicFields.valve_moc_body) item.dynamicFields.valve_moc_body = item.dynamicFields.moc;
          if (item.dynamicFields.body_material && !item.dynamicFields.valve_moc_body) item.dynamicFields.valve_moc_body = item.dynamicFields.body_material;
          if (item.dynamicFields.shellMaterial && !item.dynamicFields.valve_moc_body) item.dynamicFields.valve_moc_body = item.dynamicFields.shellMaterial;

          if (matchedProd && matchedProd.lineItemId && !item.lineItemId) {
            item.lineItemId = matchedProd.lineItemId;
            item.enquiryLineItemId = matchedProd.lineItemId;
          }

          if (extractedTerms.technicalDeviations) {
            item.technicalDeviations = item.technicalDeviations || extractedTerms.technicalDeviations;
          }
          if (matchedProd && matchedProd.standardCode) {
            item.applicableStandard = item.applicableStandard || matchedProd.standardCode;
          } else if (enquiry.standardCode) {
            item.applicableStandard = item.applicableStandard || enquiry.standardCode;
          }
          if (enquiry.requiredDeliveryWeeks) {
            item.deliveryWeeks = item.deliveryWeeks || enquiry.requiredDeliveryWeeks;
          }
        });
      }
    }

    // Set defaults or extracted terms
    req.body.manufacturerName = req.body.manufacturerName || defaultManufacturerName;
    req.body.originOfGoods = req.body.originOfGoods || defaultOriginOfGoods;
    req.body.weightDimensions = req.body.weightDimensions || defaultWeightDimensions;
    req.body.technicalDocuments = req.body.technicalDocuments || defaultTechnicalDocuments;
    req.body.deliveryTimeHeader = req.body.deliveryTimeHeader || defaultDeliveryTimeHeader;

    req.body.priceBasis = req.body.priceBasis || extractedTerms.priceBasis || defaultPriceBasis;
    req.body.packingForwardingTerms = req.body.packingForwardingTerms || extractedTerms.packingForwardingTerms || defaultPackingForwardingTerms;
    req.body.freightTerms = req.body.freightTerms || extractedTerms.freightTerms || defaultFreightTerms;
    req.body.taxDutyTerms = req.body.taxDutyTerms || defaultTaxDutyTerms;
    req.body.validityTerms = req.body.validityTerms || extractedTerms.validityTerms || defaultValidityTerms;
    req.body.tpiTerms = req.body.tpiTerms || extractedTerms.tpiTerms || defaultTpiTerms;
    req.body.transitInsurance = req.body.transitInsurance || defaultTransitInsurance;
    req.body.guaranteeTerms = req.body.guaranteeTerms || extractedTerms.guaranteeTerms || defaultGuaranteeTerms;
    req.body.paymentTerms = req.body.paymentTerms || extractedTerms.paymentTerms || defaultPaymentTerms;
    if (extractedTerms.deliverySchedule) {
      req.body.deliverySchedule = req.body.deliverySchedule || extractedTerms.deliverySchedule;
    }

    const calculated = calculateQuotationPricing(req.body);
    req.body.items = calculated.items;
    req.body.commercialTotals = calculated.commercialTotals;

    const quotation = await Quotation.create(req.body);
    
    await logActivity({
      req,
      action: 'CREATE',
      module: 'QUOTATION',
      resourceId: quotation._id,
      resourceName: quotation.quotationId,
      newState: quotation.toObject(),
      details: `Created new quotation: ${quotation.quotationId}`
    });
    
    if (req.body.enquiry) {
      await Enquiry.findByIdAndUpdate(req.body.enquiry, { status: 'Quoted' });
    }

    // Log QuotationConversionRate metric
    const Metrics = require('../models/Metrics');
    await Metrics.create({
      metricName: 'QuotationConversionRate',
      value: 1,
      metadata: { quotationId: quotation._id, enquiryId: req.body.enquiry }
    }).catch(err => console.error('[Quotation Controller] Failed to log quotation metric:', err.message));

    res.status(201).json({ status: 'success', data: { quotation: stripQuotationPricing(quotation, req.user) } });
  } catch (err) {
    next(err);
  }
};

const stripQuotationPricing = (quot, user) => {
  if (!quot) return quot;
  const hasPricing = hasPermission(user, 'Quotation', 'viewPricing');
  if (hasPricing) return quot;
  
  const obj = quot.toObject ? quot.toObject() : quot;
  delete obj.costSummary;
  delete obj.commercialTotals;
  if (obj.items) {
    obj.items = obj.items.map(item => {
      const itemObj = item.toObject ? item.toObject() : item;
      delete itemObj.unitPrice;
      delete itemObj.testingCharges;
      delete itemObj.inspectionCharges;
      delete itemObj.ndtCharges;
      delete itemObj.specialTestingCharges;
      delete itemObj.sparesCharges;
      delete itemObj.cert32Charges;
      delete itemObj.pfCharges;
      delete itemObj.tpiCharges;
      delete itemObj.discountPercent;
      delete itemObj.lineTotalExclGST;
      delete itemObj.gstAmount;
      delete itemObj.lineTotalInclGST;
      return itemObj;
    });
  }
  return obj;
};
exports.stripQuotationPricing = stripQuotationPricing;

exports.getQuotations = async (req, res, next) => {
  try {
    const filter = req.query.enquiry ? { enquiry: req.query.enquiry } : {};
    const quotations = await Quotation.find(filter)
      .populate('customer', 'companyName')
      .populate('enquiry', 'enquiryId')
      .populate('preparedBy', 'fullName')
      .populate('files')
      .sort('-createdAt');
    const cleaned = quotations.map(q => stripQuotationPricing(q, req.user));
    res.status(200).json({ status: 'success', results: cleaned.length, data: { quotations: cleaned } });
  } catch (err) {
    next(err);
  }
};

exports.getQuotation = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('customer')
      .populate('enquiry')
      .populate('preparedBy', 'fullName')
      .populate('technicalReviewBy', 'fullName')
      .populate('approvedBy', 'fullName')
      .populate('files');
      
    if (!quotation) return res.status(404).json({ status: 'error', message: 'Not found' });
    const cleaned = stripQuotationPricing(quotation, req.user);
    res.status(200).json({ status: 'success', data: { quotation: cleaned } });
  } catch (err) {
    next(err);
  }
};



exports.updateQuotationStatus = async (req, res, next) => {
  try {
    const originalQuotation = await Quotation.findById(req.params.id);
    if (!originalQuotation) {
      return res.status(404).json({ status: 'error', message: 'Quotation not found' });
    }

    const isChanged = (val1, val2) => {
      if (val1 === undefined) return false;
      if (typeof val1 === 'object' && val1 !== null) {
        return JSON.stringify(val1) !== JSON.stringify(val2);
      }
      return val1 != val2;
    };

    let technicalChanged = false;
    let commercialChanged = false;
    let isApproveAttempt = false;

    if (req.body.status !== undefined && req.body.status !== originalQuotation.status) {
      if (req.body.status === 'APPROVED' || req.body.status === 'Accepted') {
        isApproveAttempt = true;
      }
    }

    const TECHNICAL_FIELDS = [
      'manufacturerName', 'originOfGoods', 'weightDimensions', 'technicalDocuments',
      'deliveryTimeHeader', 'scopeOfSupply', 'exclusions', 'pmcConsultant', 'projectName',
      'kindAttention', 'enquiryRefText', 'subjectText', 'salutationOpeningText',
      'technicalSpecificationClause', 'technicalDeviations'
    ];

    const COMMERCIAL_FIELDS = [
      'priceBasis', 'packingForwardingTerms', 'freightTerms', 'taxDutyTerms',
      'validityTerms', 'tpiTerms', 'transitInsurance', 'guaranteeTerms',
      'paymentTerms', 'commercialTotals', 'costSummary', 'validUntil', 'deliverySchedule',
      'pricePartNotice', 'ndtRequirementText', 'specialTestingRequirementText',
      'sparesMandayChargesText', 'cert32Terms', 'cert32Percent', 'pfTerms', 'pfPercent',
      'tpiaNoticeText', 'tpiCharges', 'gstRate', 'certificationChargesTerms',
      'commercialNotes', 'cancellationTerms', 'jurisdictionTerms',
      'signatoryName', 'signatoryDesignation', 'signatoryPhone'
    ];

    TECHNICAL_FIELDS.forEach(f => {
      if (req.body[f] !== undefined && isChanged(req.body[f], originalQuotation[f])) {
        technicalChanged = true;
      }
    });

    COMMERCIAL_FIELDS.forEach(f => {
      if (req.body[f] !== undefined && isChanged(req.body[f], originalQuotation[f])) {
        commercialChanged = true;
      }
    });

    if (req.body.items && Array.isArray(req.body.items)) {
      const origItems = originalQuotation.items || [];
      req.body.items.forEach((item, index) => {
        const origItem = origItems[index] || {};
        
        const commercialItemKeys = [
          'unitPrice', 'testingCharges', 'inspectionCharges', 'ndtCharges', 
          'specialTestingCharges', 'sparesCharges', 'cert32Charges', 'pfCharges', 
          'tpiCharges', 'discountPercent', 'lineTotalExclGST', 'gstRate', 
          'gstAmount', 'lineTotalInclGST'
        ];
        commercialItemKeys.forEach(k => {
          if (item[k] !== undefined && isChanged(item[k], origItem[k])) {
            commercialChanged = true;
          }
        });

        const technicalItemKeys = [
          'itemNo', 'description', 'productCategory', 'materialGrade', 
          'applicableStandard', 'quantity', 'unit', 'testsRequired', 
          'manufacturingProcess', 'deliveryWeeks', 'technicalDeviations', 'dynamicFields'
        ];
        technicalItemKeys.forEach(k => {
          if (item[k] !== undefined && isChanged(item[k], origItem[k])) {
            technicalChanged = true;
          }
        });
      });
    }

    if (isApproveAttempt && !hasPermission(req.user, 'Quotation', 'approve')) {
      return res.status(403).json({ status: 'error', message: 'Not authorized to approve quotations' });
    }
    if (technicalChanged && !hasPermission(req.user, 'Quotation', 'editTechnical')) {
      return res.status(403).json({ status: 'error', message: 'Not authorized to edit technical parameters of quotations' });
    }
    if (commercialChanged && !hasPermission(req.user, 'Quotation', 'editCommercial')) {
      return res.status(403).json({ status: 'error', message: 'Not authorized to edit commercial parameters of quotations' });
    }

    const fields = [
      'status', 'comments', 'assignedTo', 'files', 'dynamicFields', 'items',
      'manufacturerName', 'originOfGoods', 'weightDimensions', 'technicalDocuments', 'deliveryTimeHeader',
      'priceBasis', 'packingForwardingTerms', 'freightTerms', 'taxDutyTerms', 'validityTerms', 'tpiTerms', 'transitInsurance', 'guaranteeTerms',
      'paymentTerms', 'commercialTotals', 'scopeOfSupply', 'exclusions', 'deliverySchedule', 'validUntil',
      'pmcConsultant', 'projectName', 'kindAttention', 'enquiryRefText', 'subjectText', 'salutationOpeningText',
      'technicalSpecificationClause', 'technicalDeviations',
      'pricePartNotice', 'ndtRequirementText', 'specialTestingRequirementText', 'sparesMandayChargesText',
      'cert32Terms', 'cert32Percent', 'pfTerms', 'pfPercent', 'tpiaNoticeText', 'tpiCharges', 'gstRate',
      'certificationChargesTerms', 'commercialNotes', 'cancellationTerms', 'jurisdictionTerms',
      'signatoryName', 'signatoryDesignation', 'signatoryPhone'
    ];
    const updateData = {};
    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        updateData[f] = req.body[f];
      }
    });

    if (updateData.items || updateData.cert32Percent !== undefined || updateData.pfPercent !== undefined || updateData.tpiCharges !== undefined || updateData.gstRate !== undefined) {
      const mergedForCalc = {
        ...originalQuotation.toObject(),
        ...updateData,
        items: updateData.items || originalQuotation.items || []
      };
      const calculated = calculateQuotationPricing(mergedForCalc);
      updateData.items = calculated.items;
      updateData.commercialTotals = calculated.commercialTotals;
    }

    const { status, assignedTo } = req.body;
    if (status === 'APPROVED') updateData.approvedBy = req.user._id;
    if (status === 'TECH_REVIEW') updateData.technicalReviewBy = req.user._id;

    const quotation = await Quotation.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate('customer')
      .populate('enquiry')
      .populate('preparedBy', 'fullName')
      .populate('technicalReviewBy', 'fullName')
      .populate('approvedBy', 'fullName')
      .populate('files');

    await logActivity({
      req,
      action: 'UPDATE',
      module: 'QUOTATION',
      resourceId: quotation._id,
      resourceName: quotation.quotationId,
      previousState: originalQuotation.toObject(),
      newState: quotation.toObject(),
      details: `Updated quotation status/fields: ${quotation.quotationId}`
    });

    if (status && status !== originalQuotation.status) {
      if (status === 'TECH_REVIEW') {
        await notifyRoles({ roles: ['DESIGN'], type: 'QUOTE_APPROVAL', title: 'Quotation Tech Review', message: `Quotation ${quotation.quotationId} needs technical review.`, related_id: quotation._id });
      } else if (status === 'PENDING_APPROVAL') {
        await notifyRoles({ roles: ['DIRECTOR', 'DIR'], type: 'QUOTE_APPROVAL', title: 'Quotation Approval', message: `Quotation ${quotation.quotationId} needs director approval.`, related_id: quotation._id });
        // Send email mock for testing via dummy user array
        const adminUsers = await require('../models/User').find({ role: { $in: ['DIRECTOR', 'DIR'] } });
        adminUsers.forEach(u => {
          sendEmail({ userId: u._id, subject: 'Quote Approval Required', text: `Please approve quote ${quotation.quotationId}` });
        });
      } else if (status === 'APPROVED' || status === 'REJECTED') {
        if (quotation.preparedBy) {
          await createNotification({ user_id: quotation.preparedBy, type: 'QUOTE_APPROVAL', title: `Quotation ${status}`, message: `Quotation ${quotation.quotationId} was ${status}.`, related_id: quotation._id });
        }
      }
    }

    if (assignedTo && assignedTo.toString() !== originalQuotation.assignedTo?.toString()) {
       await createNotification({ user_id: assignedTo, type: 'QUOTE_APPROVAL', title: 'Quotation Assigned', message: `Quotation ${quotation.quotationId} was assigned to you.`, related_id: quotation._id });
    }

    res.status(200).json({ status: 'success', data: { quotation: stripQuotationPricing(quotation, req.user) } });
  } catch (err) {
    next(err);
  }
};

exports.downloadPDF = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('customer')
      .populate('enquiry')
      .populate('preparedBy', 'fullName');
      
    if (!quotation) {
      return res.status(404).json({ status: 'error', message: 'Quotation not found' });
    }

    const pdfBuffer = await generateQuotationPdf(quotation);
    const revStr = `Rev${String(quotation.revisionNumber || 0).padStart(2, '0')}`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length,
      'Content-Disposition': `attachment; filename="${quotation.quotationId || 'Quotation'}_${revStr}.pdf"`
    });
    res.end(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

const { generateQuotationPdf } = require('../services/pdfService');
const { uploadFile } = require('../services/localStorageService');
const FileMetadata = require('../models/FileMetadata');

exports.generatePdf = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('customer')
      .populate('preparedBy', 'fullName')
      .populate('files');
      
    if (!quotation) return res.status(404).json({ status: 'error', message: 'Not found' });

    // 1. Generate PDF buffer using puppeteer service
    const pdfBuffer = await generateQuotationPdf(quotation);
    
    // 2. Format distinct filename with revision number and timestamp
    const revNumber = quotation.revisionNumber || 0;
    const revLabel = `Rev${String(revNumber).padStart(2, '0')}`;
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const fileName = `${quotation.quotationId}_${revLabel}_${dateStr}_${timeStr}.pdf`;
    const mimeType = 'application/pdf';
    
    const fileKey = await uploadFile(pdfBuffer, fileName, mimeType);

    // 3. Save FileMetadata tracking record with revision info
    const fileMeta = await FileMetadata.create({
      fileName,
      originalName: fileName,
      fileKey,
      mimeType,
      size: pdfBuffer.length,
      uploadedBy: req.user._id,
      module: 'Quotation',
      entityId: quotation._id,
      revisionNumber: revNumber,
      isGeneratedPdf: true,
      metadata: {
        revisionNumber: revNumber,
        revisionLabel: `Rev ${String(revNumber).padStart(2, '0')}`,
        generatedAt: now,
        isLatest: true
      }
    });

    // 4. Link new FileMetadata to Quotation
    await Quotation.findByIdAndUpdate(quotation._id, { $push: { files: fileMeta._id } });

    // 5. Return updated quotation completely populated
    const populatedQuotation = await Quotation.findById(quotation._id)
      .populate('customer')
      .populate('enquiry')
      .populate('preparedBy', 'fullName')
      .populate('technicalReviewBy', 'fullName')
      .populate('approvedBy', 'fullName')
      .populate('files');

    res.status(201).json({ status: 'success', data: { quotation: stripQuotationPricing(populatedQuotation, req.user), newFile: fileMeta } });
  } catch (err) {
    next(err);
  }
};

exports.deleteQuotation = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ status: 'fail', message: 'Quotation not found' });
    }

    await Quotation.findByIdAndDelete(req.params.id);

    await logActivity({
      req,
      action: 'DELETE',
      module: 'QUOTATION',
      resourceId: quotation._id,
      resourceName: quotation.quotationId,
      previousState: quotation.toObject(),
      newState: null,
      details: `Permanently deleted quotation: ${quotation.quotationId}`
    });

    res.status(200).json({ status: 'success', message: 'Quotation deleted' });
  } catch (err) {
    next(err);
  }
};

async function extractItemsFromEnquiry(enquiry) {
  const EmailMessage = require('../models/EmailMessage');
  const boqParserService = require('../services/boqParserService');

  let items = [];

  // 1. If enquiry has structured products array
  if (enquiry.products && enquiry.products.length > 0) {
    items = enquiry.products.map((p, idx) => {
      const pDynamic = { ...(p.dynamicFields || {}) };
      // Ensure all canonical keys are synchronized in dynamicFields
      if (pDynamic.size && !pDynamic.valve_size) pDynamic.valve_size = pDynamic.size;
      if (pDynamic.size_mm && !pDynamic.valve_size) pDynamic.valve_size = pDynamic.size_mm;
      if (pDynamic.valveSize && !pDynamic.valve_size) pDynamic.valve_size = pDynamic.valveSize;
      if (pDynamic.class && !pDynamic.valve_class) pDynamic.valve_class = pDynamic.class;
      if (pDynamic.pressure_class && !pDynamic.valve_class) pDynamic.valve_class = pDynamic.pressure_class;
      if (pDynamic.valveClass && !pDynamic.valve_class) pDynamic.valve_class = pDynamic.valveClass;
      if (pDynamic.type && !pDynamic.valve_type) pDynamic.valve_type = pDynamic.type;
      if (pDynamic.valveType && !pDynamic.valve_type) pDynamic.valve_type = pDynamic.valveType;
      if (pDynamic.operating && !pDynamic.valve_operating) pDynamic.valve_operating = pDynamic.operating;
      if (pDynamic.operation && !pDynamic.valve_operating) pDynamic.valve_operating = pDynamic.operation;
      if (pDynamic.actuation && !pDynamic.valve_operating) pDynamic.valve_operating = pDynamic.actuation;
      if (pDynamic.end_connection && !pDynamic.valve_end_connection) pDynamic.valve_end_connection = pDynamic.end_connection;
      if (pDynamic.endConnection && !pDynamic.valve_end_connection) pDynamic.valve_end_connection = pDynamic.endConnection;
      if (pDynamic.moc && !pDynamic.valve_moc_body) pDynamic.valve_moc_body = pDynamic.moc;
      if (pDynamic.body_material && !pDynamic.valve_moc_body) pDynamic.valve_moc_body = pDynamic.body_material;
      if (pDynamic.shellMaterial && !pDynamic.valve_moc_body) pDynamic.valve_moc_body = pDynamic.shellMaterial;

      return {
        itemNo: p.itemNo || idx + 1,
        enquirySrNo: p.enquirySrNo || p.itemNo || idx + 1,
        lineItemId: p.lineItemId || `${enquiry.enquiryId || 'ENQ'}-LI-${String(idx + 1).padStart(3, '0')}`,
        enquiryLineItemId: p.lineItemId || `${enquiry.enquiryId || 'ENQ'}-LI-${String(idx + 1).padStart(3, '0')}`,
        description: p.description || '',
        productCategory: p.category || enquiry.productCategory || 'Valves',
        quantity: (p.quantity !== undefined && p.quantity !== null && p.quantity !== '') ? Number(p.quantity) : null,
        unit: p.unit || 'NOS',
        materialGrade: pDynamic.valve_moc_body?.value || pDynamic.valve_moc_body || p.materialGrade || '',
        applicableStandard: p.standardCode || enquiry.standardCode || '',
        unitPrice: p.unitPrice || 0,
        lineTotalExclGST: p.lineTotalExclGST || 0,
        sourceSpecifications: p.sourceSpecifications || {},
        normalizedSpecifications: p.normalizedSpecifications || {},
        masterData: p.masterData || {},
        derivedSpecifications: p.derivedSpecifications || {},
        validation: p.validation || { isValid: true, warnings: [], needsManualReview: false },
        fieldConfidences: p.fieldConfidences || {},
        dynamicFields: pDynamic
      };
    });
    return items;
  }

  // 2. Try parsing email thread messages
  if (enquiry.threadId) {
    const emails = await EmailMessage.find({ threadId: enquiry.threadId });
    for (const email of emails) {
      if (email.bodyText) {
        const parsed = boqParserService.parseEmailBodyLineItems(email.bodyText);
        if (parsed && parsed.length > 0) {
          items = parsed.map((p, pIdx) => ({
            itemNo: pIdx + 1,
            lineItemId: `${enquiry.enquiryId || 'ENQ'}-LI-${String(pIdx + 1).padStart(3, '0')}`,
            enquiryLineItemId: `${enquiry.enquiryId || 'ENQ'}-LI-${String(pIdx + 1).padStart(3, '0')}`,
            description: p.productDescription || p.description || '',
            productCategory: p.productCategory || enquiry.productCategory || 'Valves',
            quantity: (p.quantity !== undefined && p.quantity !== null && p.quantity !== '') ? Number(p.quantity) : null,
            unit: p.unit || 'NOS',
            materialGrade: p.materialGrade || '',
            applicableStandard: p.applicableStandard || enquiry.standardCode || '',
            unitPrice: 0,
            lineTotalExclGST: 0,
            dynamicFields: {}
          }));
          break;
        }
      }
    }
  }

  // 3. Try parsing attachments extracted text
  if (items.length === 0 && enquiry.attachmentsList && enquiry.attachmentsList.length > 0) {
    for (const att of enquiry.attachmentsList) {
      if (att.extractedText) {
        const parsed = boqParserService.parseEmailBodyLineItems(att.extractedText);
        if (parsed && parsed.length > 0) {
          items = parsed.map((p, pIdx) => ({
            itemNo: pIdx + 1,
            lineItemId: `${enquiry.enquiryId || 'ENQ'}-LI-${String(pIdx + 1).padStart(3, '0')}`,
            enquiryLineItemId: `${enquiry.enquiryId || 'ENQ'}-LI-${String(pIdx + 1).padStart(3, '0')}`,
            description: p.productDescription || p.description || '',
            productCategory: p.productCategory || enquiry.productCategory || 'Valves',
            quantity: (p.quantity !== undefined && p.quantity !== null && p.quantity !== '') ? Number(p.quantity) : null,
            unit: p.unit || 'NOS',
            materialGrade: p.materialGrade || '',
            applicableStandard: p.applicableStandard || enquiry.standardCode || '',
            unitPrice: 0,
            lineTotalExclGST: 0,
            dynamicFields: {}
          }));
          break;
        }
      }
    }
  }

  // 4. Try parsing productDescription text if it contains line items
  if (items.length === 0 && enquiry.productDescription) {
    const parsed = boqParserService.parseEmailBodyLineItems(enquiry.productDescription);
    if (parsed && parsed.length > 0) {
      items = parsed.map((p, pIdx) => ({
        itemNo: pIdx + 1,
        lineItemId: `${enquiry.enquiryId || 'ENQ'}-LI-${String(pIdx + 1).padStart(3, '0')}`,
        enquiryLineItemId: `${enquiry.enquiryId || 'ENQ'}-LI-${String(pIdx + 1).padStart(3, '0')}`,
        description: p.productDescription || p.description || '',
        productCategory: p.productCategory || enquiry.productCategory || 'Valves',
        quantity: (p.quantity !== undefined && p.quantity !== null && p.quantity !== '') ? Number(p.quantity) : null,
        unit: p.unit || 'NOS',
        materialGrade: p.materialGrade || '',
        applicableStandard: p.applicableStandard || enquiry.standardCode || '',
        unitPrice: 0,
        lineTotalExclGST: 0,
        dynamicFields: {}
      }));
    }
  }

  // 5. Fallback single product item
  if (items.length === 0) {
    items = [{
      itemNo: 1,
      lineItemId: `${enquiry.enquiryId || 'ENQ'}-LI-001`,
      enquiryLineItemId: `${enquiry.enquiryId || 'ENQ'}-LI-001`,
      description: enquiry.productDescription || 'Supply of valves as per requirement',
      productCategory: enquiry.productCategory || 'Valves',
      quantity: (enquiry.quantity !== undefined && enquiry.quantity !== null && enquiry.quantity !== '') ? Number(enquiry.quantity) : null,
      unit: enquiry.unit || 'NOS',
      materialGrade: enquiry.dynamicFields?.valve_moc_body?.value || enquiry.dynamicFields?.valve_moc_body || enquiry.dynamicFields?.body_material?.value || enquiry.dynamicFields?.body_material || enquiry.dynamicFields?.moc?.value || enquiry.dynamicFields?.moc || '',
      applicableStandard: enquiry.standardCode || '',
      unitPrice: 0,
      lineTotalExclGST: 0,
      dynamicFields: { ...(enquiry.dynamicFields || {}) }
    }];
  }

  return items;
}

exports.syncEnquiryItems = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ status: 'fail', message: 'Quotation not found' });
    }
    if (!quotation.enquiry) {
      return res.status(400).json({ status: 'fail', message: 'No linked enquiry found for this quotation' });
    }

    const enquiry = await Enquiry.findById(quotation.enquiry).populate('attachmentsList');
    if (!enquiry) {
      return res.status(404).json({ status: 'fail', message: 'Linked enquiry not found' });
    }

    const extractedItems = await extractItemsFromEnquiry(enquiry);
    const calculated = calculateQuotationPricing({ ...quotation.toObject(), items: extractedItems });
    quotation.items = calculated.items;
    quotation.commercialTotals = calculated.commercialTotals;
    await quotation.save();

    res.status(200).json({
      status: 'success',
      message: `Successfully extracted ${extractedItems.length} item(s) from enquiry!`,
      data: { quotation: stripQuotationPricing(quotation, req.user) }
    });
  } catch (err) {
    next(err);
  }
};

exports.exportPricingExcel = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('customer', 'companyName')
      .populate('enquiry', 'enquiryNumber');

    if (!quotation) {
      return res.status(404).json({ status: 'fail', message: 'Quotation not found' });
    }

    const { generateQuotationPricingWorkbook } = require('../services/quotationExcelExportService');
    const buffer = generateQuotationPricingWorkbook(quotation);

    const filename = `Quotation_${quotation.quotationId || quotation._id}_Pricing.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
};

exports.validatePricingExcel = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ status: 'fail', message: 'No Excel file uploaded' });
    }

    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ status: 'fail', message: 'Quotation not found' });
    }

    const { parseAndValidatePricingSpreadsheet } = require('../services/quotationExcelImportService');
    const validationResult = parseAndValidatePricingSpreadsheet(req.file.buffer, quotation);

    res.status(200).json({
      status: 'success',
      data: validationResult
    });
  } catch (err) {
    next(err);
  }
};

exports.importPricingExcel = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ status: 'fail', message: 'No Excel file uploaded' });
    }

    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ status: 'fail', message: 'Quotation not found' });
    }

    const { parseAndValidatePricingSpreadsheet } = require('../services/quotationExcelImportService');
    const validationResult = parseAndValidatePricingSpreadsheet(req.file.buffer, quotation);

    if (!validationResult.isValid) {
      return res.status(400).json({
        status: 'fail',
        message: 'Excel validation failed',
        data: validationResult
      });
    }

    const { calculateQuotationPricing } = require('../utils/quotationCalculator');
    const calculated = calculateQuotationPricing({
      ...quotation.toObject(),
      items: validationResult.updatedItems
    }, {
      cert32Percent: quotation.cert32Percent || 5,
      pfPercent: quotation.pfPercent || 5,
      gstRate: 18
    });

    quotation.items = calculated.items;
    quotation.commercialTotals = calculated.commercialTotals;
    await quotation.save();

    res.status(200).json({
      status: 'success',
      message: `Successfully imported pricing for ${validationResult.updatedCount} item(s)!`,
      data: {
        quotation: stripQuotationPricing(quotation, req.user),
        validation: validationResult
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getLiveDiffSinceLastSent = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ status: 'fail', message: 'Quotation not found' });
    }

    const { computeQuotationDiff } = require('../services/quotationDiffService');
    const diffResult = computeQuotationDiff(quotation.lastSentSnapshot, quotation.toObject());

    const isFirstSend = !quotation.lastSentSnapshot;
    const currentRevNumber = quotation.revisionNumber || 0;
    const nextRevNumber = isFirstSend ? 0 : (diffResult.hasChanges ? currentRevNumber + 1 : currentRevNumber);

    res.status(200).json({
      status: 'success',
      data: {
        isFirstSend,
        currentRevisionNumber: currentRevNumber,
        currentRevisionLabel: `Rev ${String(currentRevNumber).padStart(2, '0')}`,
        nextRevisionNumber: nextRevNumber,
        nextRevisionLabel: `Rev ${String(nextRevNumber).padStart(2, '0')}`,
        lastSentAt: quotation.lastSentAt,
        lastSentTo: quotation.lastSentTo,
        diffResult
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.sendQuotationEmailAndRecordRevision = async (req, res, next) => {
  try {
    const { to, subject, bodyText, revisionNote, attachmentIds } = req.body;
    if (!to || !subject) {
      return res.status(400).json({ status: 'fail', message: 'Recipient email and subject are required' });
    }

    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ status: 'fail', message: 'Quotation not found' });
    }

    const { computeQuotationDiff } = require('../services/quotationDiffService');
    const diffResult = computeQuotationDiff(quotation.lastSentSnapshot, quotation.toObject());

    const isFirstSend = !quotation.lastSentSnapshot;
    let targetRevNumber = quotation.revisionNumber || 0;

    if (!isFirstSend && diffResult.hasChanges) {
      targetRevNumber += 1;
    }

    const targetRevLabel = `Rev ${String(targetRevNumber).padStart(2, '0')}`;

    quotation.revisionNumber = targetRevNumber;
    if (revisionNote) {
      quotation.revisionReason = revisionNote;
    }

    const currentSnapshot = {
      items: quotation.items.map(it => it.toObject()),
      commercialTotals: quotation.commercialTotals ? { ...quotation.commercialTotals } : {},
      techFields: {
        offerNo: quotation.offerNo,
        offerDate: quotation.offerDate,
        customerName: quotation.customerName,
        customerAddress: quotation.customerAddress,
        contactMobile: quotation.contactMobile,
        contactEmail: quotation.contactEmail,
        kindAttention: quotation.kindAttention,
        enquiryRefText: quotation.enquiryRefText,
        projectName: quotation.projectName,
        subjectText: quotation.subjectText,
        salutationOpeningText: quotation.salutationOpeningText,
        technicalSpecificationClause: quotation.technicalSpecificationClause,
        technicalDeviations: quotation.technicalDeviations
      },
      priceFields: {
        pricePartNotice: quotation.pricePartNotice,
        ndtRequirementText: quotation.ndtRequirementText,
        specialTestingRequirementText: quotation.specialTestingRequirementText,
        sparesMandayChargesText: quotation.sparesMandayChargesText,
        cert32Terms: quotation.cert32Terms,
        cert32Percent: quotation.cert32Percent,
        pfTerms: quotation.pfTerms,
        pfPercent: quotation.pfPercent,
        tpiaNoticeText: quotation.tpiaNoticeText
      },
      commFields: {
        priceBasis: quotation.priceBasis,
        packingForwardingTerms: quotation.packingForwardingTerms,
        freightTerms: quotation.freightTerms,
        taxDutyTerms: quotation.taxDutyTerms,
        validityTerms: quotation.validityTerms,
        tpiTerms: quotation.tpiTerms,
        transitInsurance: quotation.transitInsurance,
        guaranteeTerms: quotation.guaranteeTerms,
        paymentTerms: quotation.paymentTerms,
        deliverySchedule: quotation.deliverySchedule
      }
    };

    const revisionRecord = {
      revisionNumber: targetRevNumber,
      revisionLabel: targetRevLabel,
      revisionReason: revisionNote || (isFirstSend ? 'Initial official quotation offer sent to client' : 'Updated quotation terms/pricing sent to client'),
      createdAt: new Date(),
      createdBy: req.user._id,
      createdByName: req.user.fullName || req.user.username || 'Engineer',
      isSentToCustomer: true,
      sentAt: new Date(),
      sentToEmail: to,
      changesSummary: diffResult.itemDiffs.concat(diffResult.termsDiffs),
      summaryTextList: diffResult.summaryTextList,
      totalsDiff: diffResult.totalsDiff,
      snapshot: currentSnapshot
    };

    if (!quotation.revisions) quotation.revisions = [];
    quotation.revisions.push(revisionRecord);

    quotation.lastSentSnapshot = currentSnapshot;
    quotation.lastSentAt = new Date();
    quotation.lastSentTo = to;
    quotation.status = 'Sent';

    await quotation.save();

    const { sendEmail } = require('../services/emailService');
    const FileMetadata = require('../models/FileMetadata');
    const { getFileBuffer } = require('../services/localStorageService');

    const emailOptions = {
      to,
      subject,
      text: bodyText || '',
      html: `<div style="font-family: sans-serif; line-height: 1.5; color: #333;">
              <p>${(bodyText || '').replace(/\\n/g, '<br>')}</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
              <p style="font-size: 11px; color: #888;">Quotation Ref: ${quotation.quotationId} (${targetRevLabel}) dispatched from Petro Valve Workflow Platform.</p>
             </div>`,
      attachments: []
    };

    if (attachmentIds && Array.isArray(attachmentIds) && attachmentIds.length > 0) {
      const files = await FileMetadata.find({ _id: { $in: attachmentIds } });
      for (const file of files) {
        try {
          const buffer = await getFileBuffer(file.fileKey);
          if (buffer) {
            emailOptions.attachments.push({
              filename: file.originalName,
              content: buffer,
              contentType: file.mimeType
            });
          }
        } catch (fileErr) {
          console.error(`Failed to attach file ${file.fileName}:`, fileErr);
        }
      }
    }

    await sendEmail(emailOptions);

    res.status(200).json({
      status: 'success',
      message: `Quotation email successfully sent to ${to} as ${targetRevLabel}!`,
      data: {
        quotation: stripQuotationPricing(quotation, req.user),
        revision: revisionRecord
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getRevisionsHistory = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id).populate('revisions.createdBy', 'fullName role email');
    if (!quotation) {
      return res.status(404).json({ status: 'fail', message: 'Quotation not found' });
    }

    res.status(200).json({
      status: 'success',
      data: {
        quotationId: quotation.quotationId,
        currentRevisionNumber: quotation.revisionNumber || 0,
        currentRevisionLabel: `Rev ${String(quotation.revisionNumber || 0).padStart(2, '0')}`,
        lastSentAt: quotation.lastSentAt,
        lastSentTo: quotation.lastSentTo,
        revisions: quotation.revisions || []
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.createManualRevisionMilestone = async (req, res, next) => {
  try {
    const { revisionReason } = req.body;
    if (!revisionReason) {
      return res.status(400).json({ status: 'fail', message: 'Revision note/reason is required' });
    }

    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ status: 'fail', message: 'Quotation not found' });
    }

    const { computeQuotationDiff } = require('../services/quotationDiffService');
    const diffResult = computeQuotationDiff(quotation.lastSentSnapshot, quotation.toObject());

    const isFirstSend = !quotation.lastSentSnapshot;
    let targetRevNumber = (quotation.revisionNumber || 0) + 1;
    if (isFirstSend && (quotation.revisions?.length || 0) === 0) {
      targetRevNumber = 0;
    }

    const targetRevLabel = `Rev ${String(targetRevNumber).padStart(2, '0')}`;
    quotation.revisionNumber = targetRevNumber;
    quotation.revisionReason = revisionReason;

    const currentSnapshot = {
      items: quotation.items.map(it => it.toObject()),
      commercialTotals: quotation.commercialTotals ? { ...quotation.commercialTotals } : {},
      techFields: { ...quotation.toObject() },
      priceFields: { ...quotation.toObject() },
      commFields: { ...quotation.toObject() }
    };

    const revisionRecord = {
      revisionNumber: targetRevNumber,
      revisionLabel: targetRevLabel,
      revisionReason,
      createdAt: new Date(),
      createdBy: req.user._id,
      createdByName: req.user.fullName || req.user.username || 'Engineer',
      isSentToCustomer: false,
      changesSummary: diffResult.itemDiffs.concat(diffResult.termsDiffs),
      summaryTextList: diffResult.summaryTextList,
      totalsDiff: diffResult.totalsDiff,
      snapshot: currentSnapshot
    };

    if (!quotation.revisions) quotation.revisions = [];
    quotation.revisions.push(revisionRecord);
    quotation.lastSentSnapshot = currentSnapshot;
    await quotation.save();

    res.status(200).json({
      status: 'success',
      message: `Revision milestone ${targetRevLabel} created successfully!`,
      data: {
        quotation: stripQuotationPricing(quotation, req.user),
        revision: revisionRecord
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getPricingSuggestions = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ status: 'fail', message: 'Quotation not found' });
    }

    const { getQuotationPricingSuggestions } = require('../services/historicalPricingService');
    const suggestions = await getQuotationPricingSuggestions(quotation.items, quotation._id);

    res.status(200).json({
      status: 'success',
      data: {
        quotationId: quotation.quotationId,
        suggestions
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getCustomPricingSuggestions = async (req, res, next) => {
  try {
    const { items = [] } = req.body;
    const { getQuotationPricingSuggestions } = require('../services/historicalPricingService');
    const suggestions = await getQuotationPricingSuggestions(items, null);

    res.status(200).json({
      status: 'success',
      data: {
        suggestions
      }
    });
  } catch (err) {
    next(err);
  }
};

// ── 7-STEP WORKFLOW LIFECYCLE CONTROLLERS ──────────────────────────────────────

/**
 * Step 2: Sales routes Technical Section to QC Supervisor
 */
exports.routeToQc = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('customer')
      .populate('enquiry');

    if (!quotation) {
      return res.status(404).json({ status: 'fail', message: 'Quotation not found' });
    }

    quotation.status = 'TECH_REVIEW';
    quotation.returnReason = undefined;
    await quotation.save();

    // Send in-app notification & WhatsApp trigger to QCS / QC team
    await notifyRoles({
      roles: ['QCS', 'QCE', 'DIR', 'SA'],
      type: 'QUOTATION_ROUTED_TO_QC',
      title: `📋 Quotation ${quotation.quotationId} Routed for Technical Review`,
      message: `Sales engineer has submitted ${quotation.items?.length || 0} valve item(s) for QC validation and test requirement checks.`,
      related_id: quotation._id
    });

    res.status(200).json({
      status: 'success',
      message: 'Quotation successfully routed to QC Supervisor for Technical Review!',
      data: { quotation: stripQuotationPricing(quotation, req.user) }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Step 3: QC Supervisor validates and locks technical parameters
 */
exports.submitTechnicalReview = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('customer')
      .populate('enquiry');

    if (!quotation) {
      return res.status(404).json({ status: 'fail', message: 'Quotation not found' });
    }

    const { notes = '' } = req.body;

    quotation.technicalReviewBy = req.user._id;
    quotation.technicalReviewAt = new Date();
    quotation.technicalReviewNotes = notes;
    quotation.technicalLocked = true;
    quotation.status = 'CHECKER_REVIEW';
    await quotation.save();

    // Notify Sales Manager (Checker)
    await notifyRoles({
      roles: ['MGR', 'DIR', 'SA'],
      type: 'QUOTATION_TECH_REVIEW_COMPLETE',
      title: `✅ Technical Review Complete: ${quotation.quotationId}`,
      message: `QC Supervisor has validated and locked technical specifications. Ready for Sales Manager checker review.`,
      related_id: quotation._id
    });

    res.status(200).json({
      status: 'success',
      message: 'Technical specifications validated and locked. Quotation forwarded to Sales Manager for Checker Review!',
      data: { quotation: stripQuotationPricing(quotation, req.user) }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Step 4: Sales Manager Checker Review (Approve & Forward OR Return for Revision)
 */
exports.checkerReview = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('customer')
      .populate('enquiry');

    if (!quotation) {
      return res.status(404).json({ status: 'fail', message: 'Quotation not found' });
    }

    const { decision, notes = '' } = req.body;

    if (decision === 'APPROVE') {
      quotation.checkedBy = req.user._id;
      quotation.checkedAt = new Date();
      quotation.checkerNotes = notes;
      quotation.status = 'PENDING_APPROVAL';
      quotation.returnReason = undefined;
      await quotation.save();

      // Notify Director for final approval
      await notifyRoles({
        roles: ['DIR', 'SA'],
        type: 'QUOTATION_AWAITING_DIRECTOR_APPROVAL',
        title: `🚀 Quotation ${quotation.quotationId} Awaiting Director Final Approval`,
        message: `Sales Manager has approved commercial terms. Awaiting final Director sign-off to unlock official PDF and email dispatch.`,
        related_id: quotation._id
      });

      return res.status(200).json({
        status: 'success',
        message: 'Quotation approved by Checker and forwarded to Director for final sign-off!',
        data: { quotation: stripQuotationPricing(quotation, req.user) }
      });
    } else if (decision === 'RETURN') {
      if (!notes || notes.trim() === '') {
        return res.status(400).json({ status: 'fail', message: 'Mandatory return reason / comment is required when returning a quotation.' });
      }

      quotation.status = 'DRAFT';
      quotation.returnReason = notes;
      quotation.technicalLocked = false; // unlock for corrections
      await quotation.save();

      // Notify Sales Preparer
      if (quotation.preparedBy) {
        await createNotification({
          user_id: quotation.preparedBy,
          type: 'QUOTATION_RETURNED_FOR_REVISION',
          title: `⚠️ Quotation ${quotation.quotationId} Returned by Sales Manager`,
          message: `Sales Manager returned quotation with reason: "${notes}".`,
          related_id: quotation._id
        });
      }

      await notifyRoles({
        roles: ['SALES', 'SA'],
        type: 'QUOTATION_RETURNED_FOR_REVISION',
        title: `⚠️ Quotation ${quotation.quotationId} Returned for Revision`,
        message: `Sales Manager returned quotation with reason: "${notes}".`,
        related_id: quotation._id
      });

      return res.status(200).json({
        status: 'success',
        message: 'Quotation returned for revision with comments.',
        data: { quotation: stripQuotationPricing(quotation, req.user) }
      });
    } else {
      return res.status(400).json({ status: 'fail', message: 'Invalid decision. Expected APPROVE or RETURN.' });
    }
  } catch (err) {
    next(err);
  }
};

/**
 * Step 5: Director Final Approval
 */
exports.directorApprove = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('customer')
      .populate('enquiry');

    if (!quotation) {
      return res.status(404).json({ status: 'fail', message: 'Quotation not found' });
    }

    const { notes = '' } = req.body;

    quotation.approvedBy = req.user._id;
    quotation.approvedAt = new Date();
    quotation.approvalNotes = notes;
    quotation.status = 'APPROVED';
    quotation.returnReason = undefined;
    await quotation.save();

    // Notify sales and preparer that PDF and Email are unlocked
    if (quotation.preparedBy) {
      await createNotification({
        user_id: quotation.preparedBy,
        type: 'QUOTATION_APPROVED_BY_DIRECTOR',
        title: `🎉 Quotation ${quotation.quotationId} Approved by Director!`,
        message: `Director sign-off complete. Official PDF generation and client email dispatch are now active.`,
        related_id: quotation._id
      });
    }

    await notifyRoles({
      roles: ['SALES', 'SA', 'MGR'],
      type: 'QUOTATION_APPROVED_BY_DIRECTOR',
      title: `🎉 Quotation ${quotation.quotationId} Approved by Director!`,
      message: `Director sign-off complete. Official PDF generation and client email dispatch are now active.`,
      related_id: quotation._id
    });

    // M3: Auto-create Drawing Request and notify TDS team (Idempotent)
    try {
      const tdsService = require('../services/tdsService');
      await tdsService.createDrawingRequestFromQuotation(quotation);
    } catch (tdsErr) {
      console.error('[TDS Service] Warning: Failed to auto-create drawing request:', tdsErr.message);
    }

    res.status(200).json({
      status: 'success',
      message: 'Quotation officially approved by Director! PDF generation, client email, and TDS drawing request are now active.',
      data: { quotation: stripQuotationPricing(quotation, req.user) }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Unlock technical section (Super Admin / Director only)
 */
exports.unlockTechnical = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ status: 'fail', message: 'Quotation not found' });
    }

    quotation.technicalLocked = false;
    await quotation.save();

    res.status(200).json({
      status: 'success',
      message: 'Technical specifications unlocked for editing.',
      data: { quotation: stripQuotationPricing(quotation, req.user) }
    });
  } catch (err) {
    next(err);
  }
};

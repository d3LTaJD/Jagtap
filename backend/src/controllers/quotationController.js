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
            // First try by index if the description matches
            if (enquiry.products[itemIdx] && enquiry.products[itemIdx].description === item.description) {
              matchedProd = enquiry.products[itemIdx];
            } else {
              // Try by matching description exactly or partially
              matchedProd = enquiry.products.find(p => p.description === item.description) || enquiry.products[itemIdx];
            }
          }
          const prodDynamicFields = matchedProd ? (matchedProd.dynamicFields || {}) : {};
          item.dynamicFields = { ...prodDynamicFields, ...item.dynamicFields };

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

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length,
      'Content-Disposition': `attachment; filename="${quotation.quotationId || 'Quotation'}.pdf"`
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
    
    // 2. Save file to local storage
    const fileName = `${quotation.quotationId}_Official.pdf`;
    const mimeType = 'application/pdf';
    const fileKey = await uploadFile(pdfBuffer, fileName, mimeType);

    // 3. Save FileMetadata tracking record
    const fileMeta = await FileMetadata.create({
      fileName,
      originalName: fileName,
      fileKey,
      mimeType,
      size: pdfBuffer.length,
      uploadedBy: req.user._id,
      module: 'Quotation',
      entityId: quotation._id
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
    items = enquiry.products.map((p, idx) => ({
      itemNo: p.itemNo || idx + 1,
      description: p.description || '',
      productCategory: p.category || enquiry.productCategory || 'Valves',
      quantity: p.quantity || 1,
      unit: p.unit || 'NOS',
      materialGrade: p.dynamicFields?.valve_moc_body?.value || p.dynamicFields?.valve_moc_body || p.dynamicFields?.body_material?.value || p.dynamicFields?.body_material || p.dynamicFields?.moc?.value || p.dynamicFields?.moc || '',
      applicableStandard: p.standardCode || enquiry.standardCode || '',
      unitPrice: p.unitPrice || 0,
      lineTotalExclGST: p.lineTotalExclGST || 0,
      dynamicFields: { ...(p.dynamicFields || {}) }
    }));
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
            description: p.productDescription || p.description || '',
            productCategory: p.productCategory || enquiry.productCategory || 'Valves',
            quantity: p.quantity || 1,
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
            description: p.productDescription || p.description || '',
            productCategory: p.productCategory || enquiry.productCategory || 'Valves',
            quantity: p.quantity || 1,
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
        description: p.productDescription || p.description || '',
        productCategory: p.productCategory || enquiry.productCategory || 'Valves',
        quantity: p.quantity || 1,
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
      description: enquiry.productDescription || 'Supply of valves as per requirement',
      productCategory: enquiry.productCategory || 'Valves',
      quantity: enquiry.quantity || 1,
      unit: 'NOS',
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

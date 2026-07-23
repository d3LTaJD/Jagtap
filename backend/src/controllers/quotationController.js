const Quotation = require('../models/Quotation');
const Enquiry = require('../models/Enquiry');
const puppeteer = require('puppeteer');
const { createNotification, notifyRoles, sendEmail } = require('../services/notificationService');
const { logActivity } = require('../utils/logger');
const { getNextSequenceValue } = require('../utils/counter');
const { hasPermission } = require('../config/permissions');

exports.createQuotation = async (req, res, next) => {
  try {
    req.body.preparedBy = req.user._id;
    req.body.createdBy = req.body.createdBy || req.user._id;
    
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `QT-${year}-${month}-`;
    const seq = await getNextSequenceValue(prefix);
    req.body.quotationId = `${prefix}${String(seq).padStart(4, '0')}`;

    // Set standard defaults for Technical & Commercial parameters
    const defaultManufacturerName = 'M/s. PETRO VALVES PVT LTD';
    const defaultOriginOfGoods = 'INDIA';
    const defaultWeightDimensions = 'This details given at the time of dispatch';
    const defaultTechnicalDocuments = 'This is share after receiving of techno-commercial order';
    const defaultDeliveryTimeHeader = 'Provided in COMMERCIAL PART - III';

    const defaultPriceBasis = 'Ex Works Ahmedabad.';
    const defaultPackingForwardingTerms = 'Extra as given in Price Part - II, If required in wooden box then charge extra';
    const defaultFreightTerms = 'Extra at actual to your account.';
    const defaultTaxDutyTerms = 'Extra at actual to your account (18% GST default)';
    const defaultValidityTerms = 'Three Month from the date of Quote';
    const defaultTpiTerms = 'We will offer valves to your nominated TPIA agency. Charges towards TPIA fees will be to your account.';
    const defaultTransitInsurance = 'In your scope only.';
    const defaultGuaranteeTerms = '12 months from the date of commissioning or 18 months from the date of dispatch';
    const defaultPaymentTerms = '10% Advance along with PO & balance payment 90% against Proforma Invoice before dispatch.';

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
      'deliveryTimeHeader', 'scopeOfSupply', 'exclusions'
    ];

    const COMMERCIAL_FIELDS = [
      'priceBasis', 'packingForwardingTerms', 'freightTerms', 'taxDutyTerms',
      'validityTerms', 'tpiTerms', 'transitInsurance', 'guaranteeTerms',
      'paymentTerms', 'commercialTotals', 'costSummary', 'validUntil', 'deliverySchedule'
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
      'paymentTerms', 'commercialTotals', 'scopeOfSupply', 'exclusions', 'deliverySchedule', 'validUntil'
    ];
    const updateData = {};
    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        updateData[f] = req.body[f];
      }
    });

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
      .populate('enquiry');
      
    if (!quotation) {
      return res.status(404).json({ status: 'error', message: 'Quotation not found' });
    }

    const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #333; }
            .header { border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { margin: 0; color: #1e40af; }
            .details { margin-bottom: 40px; }
            .details p { margin: 5px 0; }
            .items-table { w-full border-collapse; width: 100%; margin-bottom: 40px; }
            .items-table th, .items-table td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
            .items-table th { background-color: #f8fafc; color: #475569; }
            .total { text-align: right; font-size: 1.25rem; font-weight: bold; color: #0f172a; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>PETRO VALVE</h1>
            <p>Official Commercial Quotation</p>
          </div>
          <div class="details">
            <p><strong>Quotation Ref:</strong> ${quotation.quotationId}</p>
            <p><strong>Date:</strong> ${new Date(quotation.createdAt).toLocaleDateString()}</p>
            <p><strong>Customer:</strong> ${quotation.customer?.companyName || 'N/A'}</p>
          </div>
          <table class="items-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit Price (INR)</th>
                <th>Total (INR)</th>
              </tr>
            </thead>
            <tbody>
              ${quotation.items.map(item => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.quantity}</td>
                  <td>₹${(item.unitPrice || 0).toLocaleString()}</td>
                  <td>₹${(item.lineTotalExclGST || 0).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="total">
            Grand Total (Excl. GST): ₹${(quotation.commercialTotals?.grandTotal || 0).toLocaleString()}
          </div>
        </body>
      </html>
    `;

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' } });
    await browser.close();

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

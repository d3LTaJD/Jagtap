const Quotation = require('../models/Quotation');
const Enquiry = require('../models/Enquiry');
const puppeteer = require('puppeteer');
const { createNotification, notifyRoles, sendEmail } = require('../services/notificationService');
const { logActivity } = require('../utils/logger');

exports.createQuotation = async (req, res, next) => {
  try {
    req.body.preparedBy = req.user._id;
    
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    req.body.quotationId = `QT-${year}-${month}-${Math.floor(Math.random() * 10000)}`;

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

    res.status(201).json({ status: 'success', data: { quotation } });
  } catch (err) {
    next(err);
  }
};

exports.getQuotations = async (req, res, next) => {
  try {
    const filter = req.query.enquiry ? { enquiry: req.query.enquiry } : {};
    const quotations = await Quotation.find(filter)
      .populate('customer', 'companyName')
      .populate('preparedBy', 'fullName')
      .populate('files')
      .sort('-createdAt');
    res.status(200).json({ status: 'success', results: quotations.length, data: { quotations } });
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
    res.status(200).json({ status: 'success', data: { quotation } });
  } catch (err) {
    next(err);
  }
};

exports.deleteQuotation = async (req, res, next) => {
  try {
    const quotation = await Quotation.findByIdAndDelete(req.params.id);
    if (!quotation) return res.status(404).json({ status: 'error', message: 'Not found' });
    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    next(err);
  }
};

exports.updateQuotationStatus = async (req, res, next) => {
  try {
    const { status, comments, assignedTo, files, dynamicFields } = req.body;
    const updateData = {};
    if (status) updateData.status = status;
    if (assignedTo) updateData.assignedTo = assignedTo;
    if (files) updateData.files = files;
    if (dynamicFields) updateData.dynamicFields = dynamicFields;

    if (status === 'APPROVED') updateData.approvedBy = req.user._id;
    if (status === 'TECH_REVIEW') updateData.technicalReviewBy = req.user._id;

    const originalQuotation = await Quotation.findById(req.params.id);
    const quotation = await Quotation.findByIdAndUpdate(req.params.id, updateData, { new: true });

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
        await notifyRoles({ roles: ['DIRECTOR'], type: 'QUOTE_APPROVAL', title: 'Quotation Approval', message: `Quotation ${quotation.quotationId} needs director approval.`, related_id: quotation._id });
        // Send email mock for testing via dummy user array
        const adminUsers = await require('../models/User').find({ role: 'DIRECTOR' });
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

    res.status(200).json({ status: 'success', data: { quotation } });
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
const { uploadFileToS3 } = require('../services/s3Service');
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
    
    // 2. Upload to S3 directly from memory buffer
    const fileName = `${quotation.quotationId}_Official.pdf`;
    const mimeType = 'application/pdf';
    const s3Key = await uploadFileToS3(pdfBuffer, fileName, mimeType);

    // 3. Save FileMetadata tracking record
    const fileMeta = await FileMetadata.create({
      fileName,
      originalName: fileName,
      s3Key,
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

    res.status(201).json({ status: 'success', data: { quotation: populatedQuotation, newFile: fileMeta } });
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

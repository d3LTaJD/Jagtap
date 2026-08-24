/**
 * TRACE REAL DOCUMENT DATA-FLOW AUDIT SCRIPT
 * Traces a real client engineering PDF through every stage:
 * 1. Raw PDF text extraction
 * 2. Deterministic & AI extraction
 * 3. Normalization & Validation
 * 4. MongoDB Enquiry persistence
 * 5. Quotation pre-fill mapping
 * 6. Final Quotation fields (Contract Review Checklist / Tabs)
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const fileParsingService = require('../services/fileParsingService');
const aiService = require('../services/aiService');
const extractionPipeline = require('../services/extraction/ExtractionPipeline');
const validationEngine = require('../services/extraction/ValidationEngine');
require('../models/FieldDefinition');
require('../models/Product');
require('../models/Counter');
require('../models/SystemAuditLog');
require('../models/FollowUp');
require('../models/EmailMessage');
require('../models/Attachment');
const Enquiry = require('../models/Enquiry');
const Quotation = require('../models/Quotation');
const User = require('../models/User');
const Customer = require('../models/Customer');

async function runRealDocumentAudit() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB.\n');

  const pdfFilename = '40a53d9bd8265175-22.API_6D_BALL_VALVE_Rev04.pdf';
  const filePath = path.join(__dirname, '../../uploads', pdfFilename);

  console.log('================================================================================');
  console.log('PHASE 1 AUDIT: TRACING REAL DOCUMENT PIPELINE');
  console.log('File:', pdfFilename);
  console.log('================================================================================\n');

  // 1. RAW PDF TEXT EXTRACTION
  console.log('--- STAGE 1: RAW TEXT EXTRACTION ---');
  if (!fs.existsSync(filePath)) {
    console.error('File does not exist at:', filePath);
    process.exit(1);
  }

  const buffer = fs.readFileSync(filePath);
  const parseResult = await fileParsingService.extractTextFromFile(buffer, 'application/pdf', pdfFilename);
  const rawText = parseResult.text || '';
  console.log(`✓ Extracted raw text: ${rawText.length} characters (Status: ${parseResult.status}, Confidence: ${parseResult.confidence}%).`);
  console.log('Sample snippet (first 600 chars):\n----------------------------------------');
  console.log(rawText.slice(0, 600));
  console.log('----------------------------------------\n');

  // 2. DETERMINISTIC SPEC EXTRACTION VIA EXTRACTION PIPELINE
  console.log('--- STAGE 2: DETERMINISTIC SPEC EXTRACTION ---');
  const pipelineResult = extractionPipeline.processDocument(rawText, { documentId: pdfFilename });
  console.log('Pipeline Legacy Specifications:');
  console.log(JSON.stringify(pipelineResult.legacySpecifications, null, 2));

  // 3. AI / SEMANTIC EXTRACTION
  console.log('\n--- STAGE 3: AI SEMANTIC EXTRACTION ---');
  const mockAttachment = {
    _id: new mongoose.Types.ObjectId(),
    originalFileName: pdfFilename,
    fileType: 'application/pdf',
    extractedText: rawText,
    attachmentCategory: 'Technical Specification',
    ocrConfidence: 100
  };

  const mockMetadata = {
    from: 'procurement@clientproject.com',
    subject: 'RFQ: PetroValve API 6D Ball Valves Requirement',
    hasStructuredBOQ: false
  };

  const extractedData = await aiService.extractEnquiries(
    'Please quote for the attached API 6D Ball Valve specifications.',
    [mockAttachment],
    mockMetadata
  );

  console.log('AI Extraction Response:');
  console.log('Company:', extractedData?.companyName);
  console.log('Contact:', extractedData?.contactPerson);
  console.log('Product Category:', extractedData?.productCategory);
  console.log('Line Items Count:', (extractedData?.line_items || extractedData?.enquiries || []).length);
  const itemsList = extractedData?.line_items || extractedData?.enquiries || [];
  if (itemsList.length > 0) {
    console.log('First 3 Extracted Items:');
    itemsList.slice(0, 3).forEach((it, idx) => {
      console.log(`[Item ${idx + 1}]`, {
        description: it.productDescription || it.description,
        category: it.productCategory,
        quantity: it.quantity,
        unit: it.unit,
        standardCode: it.standardCode,
        confidence: it.confidence
      });
    });
  }

  // 4. NORMALIZATION & VALIDATION
  console.log('\n--- STAGE 4: NORMALIZATION & VALIDATION ---');
  const sampleItem = {
    lineItemId: 'ENQ-AUDIT-LI-001',
    description: itemsList[0]?.productDescription || itemsList[0]?.description || 'API 6D Ball Valve 4" 300# A216 WCB',
    productCategory: 'Valves',
    quantity: 1,
    unit: 'NOS',
    dynamicFields: pipelineResult.legacySpecifications
  };

  const validationResult = validationEngine.validateLineItem(sampleItem);
  console.log('Validation Result:', validationResult);
  console.log('Validated Specs Sample:', {
    valve_size: validationEngine.validateField('valve_size', sampleItem.dynamicFields?.valve_size || '4"'),
    valve_class: validationEngine.validateField('valve_class', sampleItem.dynamicFields?.valve_class || '300#'),
    valve_type: validationEngine.validateField('valve_type', sampleItem.dynamicFields?.valve_type || 'Ball Valve'),
    valve_moc_body: validationEngine.validateField('valve_moc_body', sampleItem.dynamicFields?.shellMaterial || 'WCB')
  });

  // 5. ENQUIRY PERSISTENCE & QUOTATION PRE-FILL CHECK
  console.log('\n--- STAGE 5: ENQUIRY TO QUOTATION PRE-FILL CHECK ---');
  const quotationController = require('../controllers/quotationController');
  
  // Find a test user & customer
  const user = await User.findOne() || { _id: new mongoose.Types.ObjectId() };
  const customer = await Customer.findOne() || { _id: new mongoose.Types.ObjectId(), name: 'Test Client' };

  // Create temporary enquiry
  const testEnquiry = await Enquiry.create({
    enquiryId: `ENQ-AUDIT-${Date.now().toString().slice(-4)}`,
    customer: customer._id,
    assignedTo: user._id,
    status: 'Confirmed',
    sourceChannel: 'Email',
    contactPerson: 'Client Procurement',
    contactMobile: '9876543210',
    contactEmail: 'procurement@clientproject.com',
    productCategory: 'Valves',
    productDescription: sampleItem.description,
    quantity: 1,
    products: [{
      lineItemId: sampleItem.lineItemId,
      description: sampleItem.description,
      category: 'Valves',
      quantity: 1,
      unit: 'NOS',
      dynamicFields: pipelineResult.legacySpecifications
    }],
    dynamicFields: {
      ...pipelineResult.legacySpecifications,
      ...(extractedData?.rootFields || {})
    }
  });

  console.log(`✓ Test Enquiry Created: ${testEnquiry.enquiryId}`);

  // Trace how createQuotation maps enquiry data
  const req = {
    user,
    body: {
      enquiry: testEnquiry._id,
      customer: customer._id
    }
  };

  let createdQuotationData = null;
  const res = {
    status: (code) => ({
      json: (payload) => {
        createdQuotationData = payload;
      }
    })
  };
  const next = (err) => { if (err) console.error('createQuotation error:', err); };

  await quotationController.createQuotation(req, res, next);

  if (createdQuotationData?.data?.quotation) {
    const q = createdQuotationData.data.quotation;
    console.log(`\n✓ Quotation Created: ${q.quotationId}`);
    console.log('Quotation Items Count:', q.items?.length);
    console.log('Quotation Item 0 dynamicFields:', JSON.stringify(q.items?.[0]?.dynamicFields, null, 2));
    console.log('\nContract Review Checklist / Technical Part-I Parameters in Quotation:');
    console.log({
      manufacturerName: q.manufacturerName,
      originOfGoods: q.originOfGoods,
      technicalSpecificationClause: q.technicalSpecificationClause,
      technicalDeviations: q.technicalDeviations,
      deliverySchedule: q.deliverySchedule
    });

    // Cleanup audit records
    await Quotation.findByIdAndDelete(q._id);
  } else {
    console.error('✗ Failed to create quotation:', createdQuotationData);
  }

  await Enquiry.findByIdAndDelete(testEnquiry._id);
  console.log('\n================================================================================');
  console.log('AUDIT RUN FINISHED.');
  console.log('================================================================================');

  await mongoose.disconnect();
  process.exit(0);
}

runRealDocumentAudit().catch(err => {
  console.error('Audit Error:', err);
  process.exit(1);
});

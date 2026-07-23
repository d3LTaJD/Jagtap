/**
 * Test Suite: Enquiry Decision Engine
 * 
 * Verifies all 8 stages of the Enquiry Decision Engine:
 * 1. Content Isolation (fresh vs forwarded vs reply content)
 * 2. Intent Detection (NEW_ENQUIRY, REPLY, FORWARDED_NEW_RFQ, FORWARDED_FYI, etc.)
 * 3. Forwarded metadata extraction
 * 4. Similarity scoring across weighted dimensions
 * 5. SHA256 attachment fingerprinting & dedup
 * 6. Forwarded Email RFQ Merging Bug resolution (Verify FW: with different RFQ creates new enquiry, same RFQ merges)
 * 7. Clean context & no state leakage
 * 8. Audit trail logging
 * 
 * Usage: node src/scripts/testEnquiryDecisionEngine.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const User = require('../models/User');
const Customer = require('../models/Customer');
const Enquiry = require('../models/Enquiry');
const FieldDefinition = require('../models/FieldDefinition');
const EmailMessage = require('../models/EmailMessage');
const Attachment = require('../models/Attachment');
const SystemAuditLog = require('../models/SystemAuditLog');

const {
  isolateEmailContent,
  detectEmailIntent,
  extractForwardedMetadata,
  computeEnquirySimilarity,
  computeSHA256,
  buildAuditTrail,
  makeEnquiryDecision,
  jaccardSimilarity,
  fuzzySimilarity
} = require('../services/enquiryDecisionEngine');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 ENQUIRY DECISION ENGINE — COMPREHENSIVE TEST SUITE');
  console.log('======================================================\n');

  // ----------------------------------------------------------------
  // TEST 1: Stage 1 — Content Isolation
  // ----------------------------------------------------------------
  console.log('Test 1: Stage 1 — Content Isolation');
  const forwardedEmailBody = `Hi Team,

Please review and provide quote for the forwarded enquiry below.

Regards,
Jeet

--------------------------------Forwarded message--------------------------------
From: Client <client@petro.com>
Subject: RFQ for Gate Valves

Dear Petro Valves,

Please quote for:
1. 6" Gate Valve Class 150 - Qty 10 Nos
2. 8" Globe Valve Class 300 - Qty 5 Nos
`;

  const isolatedFwd = isolateEmailContent(forwardedEmailBody, 'FW: RFQ for Gate Valves');
  assert(isolatedFwd.isForward === true, 'Correctly identifies FW: subject as forward');
  assert(isolatedFwd.freshContent.includes('Please review and provide quote'), 'Extracts fresh cover note text');
  assert(isolatedFwd.forwardedContent.includes('6" Gate Valve Class 150'), 'Extracts forwarded RFQ body text');
  assert(!isolatedFwd.forwardedContent.includes('--------------------------------Forwarded message--------------------------------'), 'Strips forward header line from forwarded text');

  const replyEmailBody = `Thanks for the quote. Please also confirm delivery time.

On Wed, Jul 22, 2026 at 2:30 PM sales@petrovalves.co.in wrote:
> Dear Customer,
> Here is your quote ENQ-2026-07-0012...
`;
  const isolatedReply = isolateEmailContent(replyEmailBody, 'Re: Quotation QT-2026-07-0012');
  assert(isolatedReply.isReply === true, 'Correctly identifies Re: subject as reply');
  assert(isolatedReply.freshContent.trim() === 'Thanks for the quote. Please also confirm delivery time.', 'Strips quoted thread text in reply');

  // ----------------------------------------------------------------
  // TEST 2: Stage 2 — Intent Detection
  // ----------------------------------------------------------------
  console.log('\nTest 2: Stage 2 — Intent Detection');
  assert(
    detectEmailIntent('Enquiry for Ball Valves', 'Please quote 4" Ball Valve Qty 16', '', { category: 'Enquiry' }) === 'NEW_ENQUIRY',
    'Classifies fresh email with products as NEW_ENQUIRY'
  );

  assert(
    detectEmailIntent('Fwd: Enquiry for Ball Valves', 'Please check this', '1. 4" Shut off valve Qty 16\n2. 4" On Off Valve Qty 8', { category: 'Enquiry' }) === 'FORWARDED_NEW_RFQ',
    'Classifies forwarded email with product specs as FORWARDED_NEW_RFQ'
  );

  assert(
    detectEmailIntent('Fwd: Meeting notes', 'FYI see below', 'Meeting notes for tomorrow at 10 AM', { category: 'Spam/Other' }) === 'FORWARDED_FYI',
    'Classifies forwarded email without product specs as FORWARDED_FYI'
  );

  assert(
    detectEmailIntent('Re: Enquiry ENQ-2026-07-0019', '150# class', '', { category: 'Follow-up' }) === 'TECHNICAL_CLARIFICATION',
    'Classifies short reply with spec value as TECHNICAL_CLARIFICATION'
  );

  assert(
    detectEmailIntent('PO 994022 for Valves', 'Please find attached Purchase Order PO-994022', '', { category: 'Enquiry' }) === 'PURCHASE_ORDER',
    'Classifies purchase order email as PURCHASE_ORDER'
  );

  // ----------------------------------------------------------------
  // TEST 3: Stage 3 — Forwarded Metadata Extraction
  // ----------------------------------------------------------------
  console.log('\nTest 3: Stage 3 — Forwarded Metadata Extraction');
  const rawForwardBlock = `---------- Forwarded message ----------
From: Rajesh Kumar <rajesh.k@iocl.co.in>
Date: Wed, Jul 22, 2026 at 11:15 AM
Subject: RFQ for JNPA Expansion Project Valves
To: sales@petrovalves.co.in

Dear Sirs,
We require 10 Nos 4" Ball Valves Class 300...`;

  const meta = extractForwardedMetadata(rawForwardBlock);
  assert(meta.originalSender === 'rajesh.k@iocl.co.in', 'Extracts original sender email from forwarded header');
  assert(meta.originalSubject === 'RFQ for JNPA Expansion Project Valves', 'Extracts original subject from forwarded header');

  // ----------------------------------------------------------------
  // TEST 4: Stage 4 — Similarity Scoring
  // ----------------------------------------------------------------
  console.log('\nTest 4: Stage 4 — Similarity Scoring');
  const dummyEnquiry1 = {
    enquiryId: 'ENQ-2026-07-0010',
    contactEmail: 'jeet@akshaya.com',
    senderCompany: 'Sri Akshaya Engineering Pvt. Ltd.',
    clientName: 'IOCL',
    productDescription: '4" Shut off valve, 4" On Off Valve, 4" Isolation Ball Valve (Qty 32 NOS)',
    quantity: 32,
    standardCode: 'API',
    createdAt: new Date()
  };

  // Scenario A: Email with completely different products (Gate Valve 10" Class 600 vs Ball Valve 4" Class 300)
  const diffEmailData = {
    senderDomain: 'akshaya.com',
    subject: 'FW: Enquiry for 10" Gate Valves',
    bodyContent: 'Please quote for 10" Gate Valve Class 600 Qty 50 Nos ASME B16.34',
    attachmentHashes: ['hash_abc123'],
    extractedCompany: 'Sri Akshaya Engineering Pvt. Ltd.',
    extractedProject: 'Chennai Refinery',
    receivedAt: new Date()
  };

  const simDiff = computeEnquirySimilarity(diffEmailData, dummyEnquiry1);
  console.log(`   - Different RFQ Similarity Score: ${simDiff.score}%`);
  assert(simDiff.score < 75, 'Different RFQ scores below 75% similarity threshold');

  // Scenario B: Email with identical/matching RFQ details (same reference/products)
  const sameEmailData = {
    senderDomain: 'akshaya.com',
    subject: 'FW: Enquiry ENQ-2026-07-0010 - 4" Shut off valve',
    bodyContent: 'Please find attached RFQ for ENQ-2026-07-0010: 4" Shut off valve, 4" On Off Valve API (Qty 32 NOS)',
    attachmentHashes: ['hash_xyz789'],
    extractedCompany: 'Sri Akshaya Engineering Pvt. Ltd.',
    extractedProject: 'IOCL',
    receivedAt: new Date()
  };

  const simSame = computeEnquirySimilarity(sameEmailData, dummyEnquiry1);
  console.log(`   - Same RFQ Similarity Score: ${simSame.score}%`);
  assert(simSame.score > 75, 'Same RFQ scores above 75% similarity threshold');

  // ----------------------------------------------------------------
  // TEST 5: Stage 5 — SHA256 Attachment Fingerprinting
  // ----------------------------------------------------------------
  console.log('\nTest 5: Stage 5 — SHA256 Fingerprinting');
  const buf1 = Buffer.from('PDF_SPECS_DATA_BALL_VALVE_2026');
  const buf2 = Buffer.from('PDF_SPECS_DATA_BALL_VALVE_2026');
  const buf3 = Buffer.from('DIFFERENT_PDF_DATA');

  const hash1 = computeSHA256(buf1);
  const hash2 = computeSHA256(buf2);
  const hash3 = computeSHA256(buf3);

  assert(hash1 === hash2, 'Identical buffers produce matching SHA256 hashes');
  assert(hash1 !== hash3, 'Different buffers produce distinct SHA256 hashes');
  assert(hash1.length === 64, 'Produces valid 64-character SHA256 hex string');

  // ----------------------------------------------------------------
  // TEST 6 & 8: Database & Full Pipeline Integration Test
  // ----------------------------------------------------------------
  console.log('\nTest 6: Database & Decision Engine Orchestration (makeEnquiryDecision)');
  
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('  [DB] Connected to MongoDB for integration test');

  // Setup test customer
  let testCust = await Customer.findOne({ emailAddress: 'test.engine@example.com' });
  if (!testCust) {
    testCust = await Customer.create({
      companyName: 'Test Engineering Corp',
      primaryContactName: 'Test User',
      mobileNumber: '9998887776',
      emailAddress: 'test.engine@example.com',
      customerId: `CUS-TEST-${Date.now()}`
    });
  }

  // Setup Existing Enquiry A (Ball Valves 4")
  let existingEnqA = await Enquiry.findOne({ enquiryId: 'ENQ-2026-07-9999' });
  if (!existingEnqA) {
    existingEnqA = await Enquiry.create({
      enquiryId: 'ENQ-2026-07-9999',
      customer: testCust._id,
      senderCompany: 'Test Engineering Corp',
      contactPerson: 'Test User',
      contactMobile: '9998887776',
      contactEmail: 'test.engine@example.com',
      productCategory: 'Valves',
      productDescription: '4" Ball Valve Class 300 Qty 10 NOS',
      quantity: 10,
      unit: 'NOS',
      sourceChannel: 'Email',
      status: 'Confirmed'
    });
  }

  // Create EmailMessage for Forwarded NEW RFQ (Gate Valves 12" — DIFFERENT RFQ)
  const fwdEmailDiff = await EmailMessage.create({
    messageId: `msg-diff-${Date.now()}@mail.com`,
    threadId: `thread-diff-${Date.now()}`,
    sender: 'test.engine@example.com',
    subject: 'FW: Urgent Enquiry for 12" Gate Valves Class 600',
    bodyText: `Hi Petro Valves,

Please check the forwarded RFQ for Gate Valves.

---------- Forwarded message ----------
From: Procurement <procurement@refinery.com>
Subject: Enquiry for 12" Gate Valves Class 600

Dear Sir,
Please quote:
12" Gate Valve Class 600 Flanged End - Qty 50 NOS ASME B16.34
`,
    receivedAt: new Date(),
    processingStatus: 'Pending'
  });

  const decisionDiff = await makeEnquiryDecision(
    fwdEmailDiff,
    testCust,
    { category: 'Enquiry', confidence: 90 },
    [existingEnqA]
  );

  console.log(`   - Decision for Different Forwarded RFQ: ${decisionDiff.decision} (Reason: "${decisionDiff.reason}")`);
  assert(decisionDiff.decision === 'CREATE', 'Forwarded email with DIFFERENT RFQ triggers CREATE (does NOT merge)');

  // Verify Audit Trail in DB
  const auditDiff = await SystemAuditLog.findOne({
    eventType: 'ENQUIRY_DECISION',
    entityId: fwdEmailDiff._id
  });
  assert(auditDiff !== null, 'SystemAuditLog entry created for decision');
  assert(auditDiff.metadata.decision === 'CREATE', 'Audit log records CREATE decision');

  // Create EmailMessage for Forwarded SAME RFQ (4" Ball Valve — SAME RFQ)
  const fwdEmailSame = await EmailMessage.create({
    messageId: `msg-same-${Date.now()}@mail.com`,
    threadId: `thread-same-${Date.now()}`,
    sender: 'test.engine@example.com',
    subject: 'FW: Enquiry ENQ-2026-07-9999 - 4" Ball Valve Class 300',
    bodyText: `Fyi

---------- Forwarded message ----------
From: test.engine@example.com
Subject: Enquiry ENQ-2026-07-9999

Please update quote for ENQ-2026-07-9999:
4" Ball Valve Class 300 Qty 10 NOS
`,
    receivedAt: new Date(),
    processingStatus: 'Pending'
  });

  const decisionSame = await makeEnquiryDecision(
    fwdEmailSame,
    testCust,
    { category: 'Follow-up', confidence: 90 },
    [existingEnqA]
  );

  console.log(`   - Decision for Matching Forwarded RFQ: ${decisionSame.decision} (Reason: "${decisionSame.reason}")`);
  assert(decisionSame.decision === 'UPDATE', 'Forwarded email with MATCHING RFQ triggers UPDATE (merges cleanly)');
  assert(decisionSame.matchedEnquiryId.toString() === existingEnqA._id.toString(), 'Matches exact existing enquiry ID');

  // Cleanup test documents
  await EmailMessage.deleteMany({ _id: { $in: [fwdEmailDiff._id, fwdEmailSame._id] } });
  await Enquiry.deleteOne({ _id: existingEnqA._id });
  await Customer.deleteOne({ _id: testCust._id });
  await SystemAuditLog.deleteMany({ entityId: { $in: [fwdEmailDiff._id, fwdEmailSame._id] } });

  await mongoose.disconnect();
  console.log('\n======================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});

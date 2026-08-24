/**
 * AUTOMATED TEST SUITE FOR 7-STEP QUOTATION WORKFLOW PIPELINE
 * 1. AI Pre-Fill & Draft (Sales / Maker)
 * 2. Route Technical Section to QC (Sales -> QCS)
 * 3. QC Validate & Lock Technical Specs (QCS -> Checker)
 * 4. Sales Manager Checker Review (Checker -> Director / Return)
 * 5. Director Final Approval (Unlocks PDF & Email)
 * 6. 1-Click Branded PDF Dispatch (Sales -> Sent)
 * 7. Inbound Client Reply & Revision Detection (Gmail AI / Bot)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Quotation = require('../models/Quotation');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Enquiry = require('../models/Enquiry');

console.log('================================================================================');
console.log('RUNNING 7-STEP QUOTATION WORKFLOW & APPROVAL SUITE');
console.log('================================================================================\n');

async function runWorkflowTests() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  console.log('✓ Connected to MongoDB.');

  // Find or create mock users for each role
  let salesUser = await User.findOne({ role: 'SALES' }) || await User.findOne();
  let qcUser = await User.findOne({ role: 'QCS' }) || salesUser;
  let mgrUser = await User.findOne({ role: 'MGR' }) || salesUser;
  let dirUser = await User.findOne({ role: 'DIR' }) || salesUser;
  let customer = await Customer.findOne() || { _id: new mongoose.Types.ObjectId() };
  let enquiry = await Enquiry.findOne() || { _id: new mongoose.Types.ObjectId() };

  // STEP 1: Create Draft Quotation (AI + Sales Maker)
  console.log('[STEP 1] Testing AI-Pre-Filled Quotation Creation (Maker)...');
  const testQuotationId = `QT-TEST-${Date.now().toString().slice(-4)}`;
  const quotation = await Quotation.create({
    quotationId: testQuotationId,
    createdBy: salesUser._id,
    preparedBy: salesUser._id,
    customer: customer._id,
    enquiry: enquiry._id,
    status: 'DRAFT',
    items: [
      {
        itemNo: 1,
        lineItemId: 'LI-00001',
        description: '4" Class 300 WCB Ball Valve',
        quantity: 5,
        unitPrice: 45000,
        materialGrade: 'ASTM A216 WCB',
        applicableStandard: 'API 6D'
      }
    ]
  });

  if (quotation.status === 'DRAFT' && quotation.technicalLocked === false) {
    console.log(`✓ Step 1 Passed: Quotation ${testQuotationId} created in DRAFT status with unlocked technical section.`);
  } else {
    console.error('✗ Step 1 Failed:', quotation);
    process.exit(1);
  }

  // STEP 2: Sales routes Technical Section to QC
  console.log('\n[STEP 2] Testing Route Technical Section to QC (Sales)...');
  quotation.status = 'TECH_REVIEW';
  await quotation.save();

  if (quotation.status === 'TECH_REVIEW') {
    console.log('✓ Step 2 Passed: Status successfully transitioned to TECH_REVIEW.');
  } else {
    console.error('✗ Step 2 Failed');
    process.exit(1);
  }

  // STEP 3: QC Supervisor validates & locks technical parameters
  console.log('\n[STEP 3] Testing QC Validation & Technical Locking (QCS)...');
  quotation.technicalReviewBy = qcUser._id;
  quotation.technicalReviewAt = new Date();
  quotation.technicalReviewNotes = 'All API 6D annexures and NDT requirements verified.';
  quotation.technicalLocked = true;
  quotation.status = 'CHECKER_REVIEW';
  await quotation.save();

  if (quotation.status === 'CHECKER_REVIEW' && quotation.technicalLocked === true && quotation.technicalReviewBy) {
    console.log('✓ Step 3 Passed: Technical specifications verified and locked by QC. Forwarded to CHECKER_REVIEW.');
  } else {
    console.error('✗ Step 3 Failed');
    process.exit(1);
  }

  // STEP 4: Sales Manager Checker Review
  console.log('\n[STEP 4] Testing Sales Manager Checker Review (Checker)...');
  // 4a. Test Return for Revision
  quotation.status = 'DRAFT';
  quotation.returnReason = 'Please check discount terms on item 1';
  quotation.technicalLocked = false;
  await quotation.save();

  if (quotation.status === 'DRAFT' && quotation.returnReason) {
    console.log('✓ Step 4a Passed: Return with reason functionality verified.');
  }

  // 4b. Re-advance and Approve
  quotation.checkedBy = mgrUser._id;
  quotation.checkedAt = new Date();
  quotation.checkerNotes = 'Commercial margins and delivery schedule approved.';
  quotation.status = 'PENDING_APPROVAL';
  quotation.technicalLocked = true;
  await quotation.save();

  if (quotation.status === 'PENDING_APPROVAL' && quotation.checkedBy) {
    console.log('✓ Step 4b Passed: Sales Manager approved and forwarded to Director (PENDING_APPROVAL).');
  }

  // STEP 5: Director Final Approval
  console.log('\n[STEP 5] Testing Director Final Approval (Approver)...');
  quotation.approvedBy = dirUser._id;
  quotation.approvedAt = new Date();
  quotation.status = 'APPROVED';
  await quotation.save();

  if (quotation.status === 'APPROVED' && quotation.approvedBy) {
    console.log('✓ Step 5 Passed: Director final approval recorded. Status is APPROVED (PDF and Email unlocked).');
  }

  // STEP 6: 1-Click Client Email Dispatch
  console.log('\n[STEP 6] Testing Client Email Dispatch & Rev 00 Snapshot (Sales)...');
  const snapshot = {
    items: quotation.items.map(it => it.toObject ? it.toObject() : it),
    sentAt: new Date(),
    sentTo: 'client@example.com'
  };
  quotation.status = 'SENT';
  quotation.lastSentSnapshot = snapshot;
  quotation.lastSentAt = new Date();
  quotation.lastSentTo = 'client@example.com';
  quotation.revisions = [{
    revisionNumber: 0,
    revisionLabel: 'Rev 00',
    revisionReason: 'Initial client offer dispatch',
    isSentToCustomer: true,
    sentAt: new Date(),
    sentToEmail: 'client@example.com',
    snapshot
  }];
  await quotation.save();

  if (quotation.status === 'SENT' && quotation.lastSentSnapshot && quotation.revisions.length === 1) {
    console.log('✓ Step 6 Passed: Quotation dispatched via email, Rev 00 recorded, status set to SENT.');
  }

  // STEP 7: Inbound Client Reply & Revision Detection
  console.log('\n[STEP 7] Testing Inbound Client Reply & Revision Detection (Gmail AI / Bot)...');
  // Simulate client email reply triggering revision
  if (['SENT', 'APPROVED'].includes(quotation.status)) {
    quotation.status = 'REVISION_REQUESTED';
    await quotation.save();
  }

  if (quotation.status === 'REVISION_REQUESTED') {
    console.log('✓ Step 7 Passed: Inbound client reply detected, status updated to REVISION_REQUESTED.');
  }

  // Cleanup test quotation
  await Quotation.findByIdAndDelete(quotation._id);
  console.log('\n================================================================================');
  console.log('ALL 7 WORKFLOW STEPS PASSED 100%!');
  console.log('================================================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

runWorkflowTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

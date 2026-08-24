const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Enquiry = require('../models/Enquiry');
const FieldDefinition = require('../models/FieldDefinition');
const Quotation = require('../models/Quotation');
const Drawing = require('../models/Drawing');
const WorkOrder = require('../models/WorkOrder');
const User = require('../models/User');
const tdsService = require('../services/tdsService');
const workOrderController = require('../controllers/workOrderController');

async function runWorkOrderHardGateTest() {
  console.log('================================================================================');
  console.log('PETROVALVE M3 MANUAL ACCEPTANCE TEST: WORK ORDER CREATION & HARD GATE SEQUENCE');
  console.log('================================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/petro-valve');
  console.log('Connected to MongoDB.\n');

  // Verify existing released Work Order (WO-2026-08-4216 or similar) exists and is protected
  const existingReleasedWo = await WorkOrder.findOne({ status: 'RELEASED' });
  const existingWoId = existingReleasedWo ? existingReleasedWo.workOrderId : 'None';
  const existingApprovedRev = existingReleasedWo ? existingReleasedWo.approvedDrawingRevision : null;
  console.log(`[Baseline Audit] Found existing released Work Order: ${existingWoId} (Anchored to Rev ${existingApprovedRev})\n`);

  // Find Super Admin and TDS Engineer
  const superAdmin = await User.findOne({ role: { $in: ['SUPER_ADMIN', 'SA'] } });
  let tdsUser = await User.findOne({ role: { $in: ['DE', 'DESIGN_ENGINEER', 'QCS'] } });
  if (!tdsUser) {
    tdsUser = superAdmin;
  }

  // Create test Customer
  const customer = await Customer.create({
    customerId: `CUS-WO-TEST-${Date.now().toString().slice(-4)}`,
    companyName: 'Indian Oil Corporation Ltd (IOCL Panipat)',
    primaryContactName: 'Rajesh Kumar',
    emailAddress: 'rajesh.kumar@iocl.co.in',
    mobileNumber: '+919812345678'
  });

  // Create test Enquiry
  const enquiry = await Enquiry.create({
    enquiryId: `ENQ-WO-TEST-${Date.now().toString().slice(-4)}`,
    customer: customer._id,
    contactPerson: 'Rajesh Kumar',
    contactMobile: '+919812345678',
    contactEmail: 'rajesh.kumar@iocl.co.in',
    productCategory: 'Gate Valve',
    productDescription: '8" Class 300 Gate Valve',
    assignedTo: superAdmin._id,
    subject: 'RFQ for 8" Gate Valves',
    status: 'Verified',
    sourceChannel: 'Email'
  });

  // Create test Quotation
  const quotation = await Quotation.create({
    quotationId: `QT-2026-08-WO-${Date.now().toString().slice(-4)}`,
    customer: customer._id,
    enquiry: enquiry._id,
    createdBy: superAdmin._id,
    preparedBy: superAdmin._id,
    grandTotal: 2450000,
    status: 'APPROVED',
    items: [
      {
        itemNo: 1,
        description: '8" Class 300 Flanged RF Gate Valve, Body ASTM A216 WCB',
        quantity: 8,
        unitPrice: 250000,
        totalAmount: 2000000,
        dynamicFields: {
          valve_type: 'Gate Valve',
          valve_size: '200 mm',
          valve_class: '300#',
          valve_body_moc: 'ASTM A216 WCB',
          valve_end_connection: 'Flanged RF'
        }
      }
    ]
  });

  // STEP A: Create Drawing with Rev 00 (Approved), Rev 01 (Rejected), and Rev 02 (UNDER_REVIEW)
  console.log('--- STEP A: CREATE DRAWING WITH REV 02 (UNDER_REVIEW) ---');
  const drawing = await Drawing.create({
    drawingId: `DWG-2026-08-${Date.now().toString().slice(-4)}`,
    customer: customer._id,
    quotation: quotation._id,
    drawingNumber: 'DWG-IOCL-GATE-200-R2',
    drawingTitle: 'GA Drawing for 200 mm Class 300 Gate Valve',
    drawingType: 'CUSTOMER_GA',
    status: 'UNDER_REVIEW',
    currentRevisionNumber: 2,
    revisions: [
      {
        revisionNumber: 0,
        revisionLabel: 'Rev 00',
        fileUrl: '/uploads/dwg-rev00.pdf',
        fileName: 'dwg-rev00.pdf',
        status: 'APPROVED',
        approvedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        comments: 'Initial baseline drawing approved'
      },
      {
        revisionNumber: 1,
        revisionLabel: 'Rev 01',
        fileUrl: '/uploads/dwg-rev01.pdf',
        fileName: 'dwg-rev01.pdf',
        status: 'REJECTED',
        comments: 'Wall thickness rejected by TDS'
      },
      {
        revisionNumber: 2,
        revisionLabel: 'Rev 02',
        fileUrl: '/uploads/dwg-rev02.pdf',
        fileName: 'dwg-rev02.pdf',
        status: 'UNDER_REVIEW',
        comments: 'Customer updated flange thickness per ASME B16.5'
      }
    ]
  });
  console.log(`✓ Created Drawing ${drawing.drawingId} with 3 revisions.`);
  console.log(`✓ Active Revision for test: ${drawing.revisions[2].revisionLabel} (Status: ${drawing.revisions[2].status})\n`);

  // STEP B: Create a new Work Order linked to Rev 02
  console.log('--- STEP B: DRAFT WORK ORDER LINKED TO REV 02 ---');
  let createResStatus = null;
  let createdWorkOrder = null;

  const reqCreate = {
    body: {
      quotationId: quotation._id.toString(),
      customerId: customer._id.toString(),
      drawingId: drawing._id.toString(),
      selectedRevisionNumber: 2,
      targetDeliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      productionNotes: 'Targeting drawing revision Rev 02 for manufacturing release.'
    },
    user: superAdmin
  };
  const resCreate = {
    status: (code) => { createResStatus = code; return resCreate; },
    json: (obj) => { createdWorkOrder = obj.data?.workOrder; return resCreate; }
  };

  await workOrderController.createWorkOrder(reqCreate, resCreate, (err) => { if (err) throw err; });

  console.log(`✓ Work Order Creation Status: HTTP ${createResStatus}`);
  console.log(`✓ Drafted Work Order: ${createdWorkOrder.workOrderId}`);
  console.log(`✓ Initial Status: "${createdWorkOrder.status}" (isDrawingApproved: ${createdWorkOrder.isDrawingApproved})`);
  console.log(`✓ Linked Drawing Revision Label: "${createdWorkOrder.approvedDrawingLabel}"\n`);

  if (createdWorkOrder.status !== 'PENDING_DRAWING_APPROVAL' || createdWorkOrder.isDrawingApproved !== false) {
    throw new Error(`Expected Work Order initial status PENDING_DRAWING_APPROVAL, got ${createdWorkOrder.status}`);
  }

  // STEP C & D: Attempt Release via API -> Assert HTTP 403 Forbidden
  console.log('--- STEP C & D: ATTEMPT RELEASE -> ASSERT HTTP 403 FORBIDDEN ---');
  let releaseBlockedStatus = null;
  let releaseBlockedBody = null;

  const reqReleaseAttempt = {
    params: { id: createdWorkOrder._id.toString() },
    body: { releaseNotes: 'Attempting to release without TDS approval.' },
    user: superAdmin
  };
  const resReleaseAttempt = {
    status: (code) => { releaseBlockedStatus = code; return resReleaseAttempt; },
    json: (obj) => { releaseBlockedBody = obj; return resReleaseAttempt; }
  };

  await workOrderController.releaseWorkOrder(reqReleaseAttempt, resReleaseAttempt, (err) => {
    if (err && err.statusCode === 403) {
      releaseBlockedStatus = 403;
      releaseBlockedBody = { status: 'fail', gateBlocked: true, message: err.message };
    }
  });

  console.log(`✓ HTTP Response Status: ${releaseBlockedStatus}`);
  console.log(`✓ Gate Blocked Flag: ${releaseBlockedBody?.gateBlocked}`);
  console.log(`✓ Exact Blocked Message: "${releaseBlockedBody?.message}"`);

  if (releaseBlockedStatus !== 403 || !releaseBlockedBody?.gateBlocked) {
    throw new Error(`CRITICAL SECURITY FAILURE: Release did not return HTTP 403 Forbidden!`);
  }

  // STEP E: Assert Work Order in DB remains NOT released
  console.log('\n--- STEP E: ASSERT WORK ORDER IN DB REMAINS UNRELEASED ---');
  const unreleasedWoInDb = await WorkOrder.findById(createdWorkOrder._id);
  console.log(`✓ DB Status: "${unreleasedWoInDb.status}"`);
  console.log(`✓ DB isDrawingApproved: ${unreleasedWoInDb.isDrawingApproved}`);
  console.log(`✓ DB releasedAt: ${unreleasedWoInDb.releasedAt || 'null'}`);

  if (unreleasedWoInDb.status !== 'PENDING_DRAWING_APPROVAL' || unreleasedWoInDb.isDrawingApproved !== false) {
    throw new Error(`DB Corruption: Work Order status was illegally modified!`);
  }
  console.log('✓ Release block confirmed in MongoDB persistence.\n');

  // STEP F: Approve Rev 02 via TDS approval service
  console.log('--- STEP F: TDS APPROVES REVISION 02 ---');
  await tdsService.approveDrawingRevision({
    drawingId: drawing._id,
    revisionNumber: 2,
    user: tdsUser,
    comments: 'Rev 02 verified and 100% compliant with ASME B16.5 and client specifications.'
  });

  const reloadedDwg = await Drawing.findById(drawing._id);
  console.log(`✓ Drawing status is now: "${reloadedDwg.status}"`);
  console.log(`✓ Active Approved Revision frozen in Drawing: "${reloadedDwg.activeApprovedRevision?.revisionLabel}"\n`);

  if (reloadedDwg.status !== 'APPROVED' || reloadedDwg.activeApprovedRevision?.revisionNumber !== 2) {
    throw new Error(`TDS Approval failed to freeze Rev 02 as active approved revision!`);
  }

  // STEP G & H: Attempt Release again -> Assert HTTP 200 OK
  console.log('--- STEP G & H: RELEASE WORK ORDER AFTER APPROVAL -> ASSERT HTTP 200 OK ---');
  let releaseSuccessStatus = null;
  let releaseSuccessBody = null;

  const reqReleaseSuccess = {
    params: { id: createdWorkOrder._id.toString() },
    body: { releaseNotes: 'Official manufacturing release approved by Technical Authority.' },
    user: superAdmin
  };
  const resReleaseSuccess = {
    status: (code) => { releaseSuccessStatus = code; return resReleaseSuccess; },
    json: (obj) => { releaseSuccessBody = obj; return resReleaseSuccess; }
  };

  await workOrderController.releaseWorkOrder(reqReleaseSuccess, resReleaseSuccess, (err) => { if (err) throw err; });

  console.log(`✓ HTTP Response Status: ${releaseSuccessStatus}`);
  console.log(`✓ Success Message: "${releaseSuccessBody?.message}"\n`);

  if (releaseSuccessStatus !== 200) {
    throw new Error(`Expected Work Order release HTTP 200, got ${releaseSuccessStatus}`);
  }

  // STEP I: Assert Work Order contains frozen approved revision Rev 02
  console.log('--- STEP I: ASSERT FROZEN REVISION SNAPSHOT IN WORK ORDER ---');
  const releasedWoInDb = await WorkOrder.findById(createdWorkOrder._id);
  console.log(`✓ Final Work Order Status: "${releasedWoInDb.status}"`);
  console.log(`✓ Approved Drawing Revision: ${releasedWoInDb.approvedDrawingRevision} (${releasedWoInDb.approvedDrawingLabel})`);
  console.log(`✓ Released By: ${releasedWoInDb.releasedBy}`);
  console.log(`✓ Released At: ${releasedWoInDb.releasedAt?.toISOString()}`);
  console.log(`✓ Frozen Snapshot Revision Label: "${releasedWoInDb.frozenRevisionSnapshot?.revisionLabel}"`);

  if (releasedWoInDb.status !== 'RELEASED' || 
      releasedWoInDb.approvedDrawingRevision !== 2 || 
      releasedWoInDb.approvedDrawingLabel !== 'Rev 02') {
    throw new Error(`Frozen revision snapshot verification failed on released Work Order!`);
  }
  console.log('✓ Work Order successfully released and permanently anchored to Rev 02.\n');

  // STEP J: Assert existing Work Orders (e.g. WO-2026-08-4216) still reference their original Rev 00
  console.log('--- STEP J: VERIFY PREVIOUS RELEASED WORK ORDERS REMAIN UNCHANGED ---');
  if (existingReleasedWo) {
    const recheckedExistingWo = await WorkOrder.findById(existingReleasedWo._id);
    console.log(`✓ Existing Work Order ${recheckedExistingWo.workOrderId} Status: "${recheckedExistingWo.status}"`);
    console.log(`✓ Existing Work Order Revision: ${recheckedExistingWo.approvedDrawingRevision} (${recheckedExistingWo.approvedDrawingLabel})`);

    if (recheckedExistingWo.approvedDrawingRevision !== existingApprovedRev) {
      throw new Error(`CRITICAL VERSION CORRUPTION: Existing Work Order ${recheckedExistingWo.workOrderId} had its revision altered!`);
    }
    console.log(`✓ Immutability confirmed: Previous Work Order ${recheckedExistingWo.workOrderId} remains permanently on Rev ${existingApprovedRev}.\n`);
  }

  console.log('================================================================================');
  console.log('M3 HARD GATE SEQUENCE TEST COMPLETE: 100% SUCCESS (ALL STEPS A-J PASSED)');
  console.log('================================================================================\n');

  await mongoose.disconnect();
}

runWorkOrderHardGateTest().catch(err => {
  console.error('\n❌ Work Order Hard Gate Test Failed:', err);
  process.exit(1);
});

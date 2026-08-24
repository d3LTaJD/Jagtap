const fs = require('fs');
const assert = require('assert');

async function runEndToEndVerification() {
  console.log('======================================================================');
  console.log('  E2E TEST: IMPORT TENDER -> SAVE ENQUIRY -> REOPEN & VERIFY 12 ITEMS');
  console.log('======================================================================\n');

  const boqPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\BOQ_321105.xls';
  const pdfPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\Tender_CSBV_26-27_16.pdf';

  // 1. Authenticate
  console.log('1. Authenticating with backend...');
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@petrovalve.com', password: 'adminpassword123' })
  }).then(r => r.json());

  assert(loginRes.token, 'Failed to obtain JWT auth token');
  const token = loginRes.token;
  console.log('   ✓ Authenticated.\n');

  // 2. Run Import
  console.log('2. Running AI Tender Import via /api/enquiries/import-tender...');
  const boqBlob = new Blob([fs.readFileSync(boqPath)], { type: 'application/vnd.ms-excel' });
  const pdfBlob = new Blob([fs.readFileSync(pdfPath)], { type: 'application/pdf' });

  const form = new FormData();
  form.append('boqFiles', boqBlob, 'BOQ_321105.xls');
  form.append('specFiles', pdfBlob, 'Tender_CSBV_26-27_16.pdf');

  const importRes = await fetch('http://localhost:5000/api/enquiries/import-tender', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  }).then(r => r.json());

  assert.strictEqual(importRes.status, 'success', `Import failed: ${JSON.stringify(importRes)}`);
  const { products, tenderIntelligence } = importRes.data;

  console.log(`   ✓ Import succeeded: ${products.length} products extracted.`);
  assert.strictEqual(products.length, 12, `Expected 12 items, got ${products.length}`);

  // Check Item 1.10 destination
  const item110 = products.find(p => p.itemNo === '1.10' || p.itemNo === '1.1' || p.itemNo === '10');
  assert(item110, 'Item 1.10 not found');
  console.log(`   - Item 1.10 Destination in imported products: "${item110.destination}"`);
  assert.strictEqual(item110.destination, 'Pune GA', `Item 1.10 destination MUST be "Pune GA", got "${item110.destination}"`);
  console.log('   ✓ Item 1.10 Destination verified as "Pune GA".');

  // Check Item 1.08 destination
  const item108 = products.find(p => p.itemNo === '1.08' || p.itemNo === '1.8' || p.itemNo === '8');
  assert(item108, 'Item 1.08 not found');
  console.log(`   - Item 1.08 Destination in imported products: "${item108.destination}"`);
  assert.strictEqual(item108.destination, 'Pune, Ramanagara, Nanded & Nizamabad GAs', `Item 1.08 destination mismatch: "${item108.destination}"`);
  console.log('   ✓ Item 1.08 Destination verified as "Pune, Ramanagara, Nanded & Nizamabad GAs".\n');

  // 3. Create New Enquiry with 12 BOQ Items
  console.log('3. Saving New Tender Enquiry with all 12 items via POST /api/enquiries...');
  const totalQty = products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
  const tenderNo = tenderIntelligence?.tenderDetails?.gemTenderNo || tenderIntelligence?.tenderDetails?.tenderNumber || 'GEM/2026/B/MNGL-CSBV';

  const createPayload = {
    customerData: {
      companyName: tenderIntelligence?.tenderDetails?.customer || 'Maharashtra Natural Gas Limited (MNGL)',
      primaryContactName: tenderIntelligence?.contactPersons?.[0]?.name || 'Ganesh Said',
      mobileNumber: tenderIntelligence?.contactPersons?.[0]?.phone || '+91 (20) 25611000',
      emailAddress: tenderIntelligence?.contactPersons?.[0]?.email || 'gasald@mngl.in'
    },
    enquiryData: {
      sourceChannel: 'GEM Portal',
      sourceType: 'Tender',
      tenderNumber: tenderNo,
      gemTenderNo: tenderNo,
      contactPerson: tenderIntelligence?.contactPersons?.[0]?.name || 'Ganesh Said',
      contactMobile: tenderIntelligence?.contactPersons?.[0]?.phone || '+91 (20) 25611000',
      contactEmail: tenderIntelligence?.contactPersons?.[0]?.email || 'gasald@mngl.in',
      tenderDeadline: tenderIntelligence?.tenderTimeline?.bidSubmissionDate || '2026-05-07',
      productCategory: 'Valves',
      productDescription: `${products.length} BOQ Line Items (Valves) — Total Quantity: ${totalQty} NO.`,
      quantity: totalQty,
      unit: 'NO.',
      priority: 'High',
      specialRequirements: 'Hydrostatic testing, NACE MR0175 compliance, EN 10204 3.1 certification required',
      products: products,
      tenderIntelligence: tenderIntelligence
    }
  };

  const createRes = await fetch('http://localhost:5000/api/enquiries', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(createPayload)
  }).then(r => r.json());

  assert.strictEqual(createRes.status, 'success', `Create enquiry failed: ${JSON.stringify(createRes)}`);
  const savedEnquiry = createRes.data.enquiry;
  const enquiryId = savedEnquiry._id;
  console.log(`   ✓ Enquiry created successfully: ${savedEnquiry.enquiryId} (ID: ${enquiryId}).\n`);

  // 4. Simulate Page Refresh / Reopening: GET /api/enquiries/:id
  console.log(`4. Reopening enquiry via GET /api/enquiries/${enquiryId}...`);
  const fetchRes = await fetch(`http://localhost:5000/api/enquiries/${enquiryId}`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json());

  assert.strictEqual(fetchRes.status, 'success', `Fetch enquiry failed: ${JSON.stringify(fetchRes)}`);
  const fetchedEnq = fetchRes.data.enquiry;

  console.log('\n5. Validating Persisted Ground Truth & Destinations:');
  console.log(`   - Enquiry ID: ${fetchedEnq.enquiryId}`);
  console.log(`   - Customer: ${fetchedEnq.customer?.companyName || fetchedEnq.senderCompany}`);
  console.log(`   - Total Aggregate Quantity: ${fetchedEnq.quantity} (Assert: 529)`);
  assert.strictEqual(fetchedEnq.quantity, 529, `Aggregate quantity expected 529, got ${fetchedEnq.quantity}`);

  console.log(`   - Total Line Items in products array: ${fetchedEnq.products?.length} (Assert: 12)`);
  assert.strictEqual(fetchedEnq.products?.length, 12, `Expected exactly 12 items in products array, got ${fetchedEnq.products?.length}`);

  const fetchedTotalQty = fetchedEnq.products.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
  console.log(`   - Sum of individual line item quantities: ${fetchedTotalQty} (Assert: 529)`);
  assert.strictEqual(fetchedTotalQty, 529, `Sum of line item quantities expected 529, got ${fetchedTotalQty}`);

  console.log('\n--- Reopened Enquiry Line Items Table ---');
  console.log(String('#').padEnd(6) + String('Description').padEnd(45) + String('Qty').padEnd(8) + String('Unit').padEnd(8) + 'Destination');
  console.log('------------------------------------------------------------------------------------------------------------------------');

  fetchedEnq.products.forEach((p, idx) => {
    console.log(
      String(p.itemNo || idx + 1).padEnd(6) +
      String(p.description.substring(0, 42) + (p.description.length > 42 ? '...' : '')).padEnd(45) +
      String(p.quantity).padEnd(8) +
      String(p.unit).padEnd(8) +
      String(p.destination)
    );
  });
  console.log('------------------------------------------------------------------------------------------------------------------------\n');

  // Verify Item 1.10
  const reopened110 = fetchedEnq.products.find(p => String(p.itemNo) === '1.10' || String(p.itemNo) === '1.1' || String(p.itemNo) === '10');
  assert(reopened110, 'Reopened Item 1.10 not found');
  console.log(`   - Reopened Item 1.10: Qty=${reopened110.quantity}, Unit=${reopened110.unit}, Destination="${reopened110.destination}"`);
  assert.strictEqual(reopened110.quantity, 19, 'Item 1.10 quantity must be 19');
  assert.strictEqual(reopened110.destination, 'Pune GA', 'Item 1.10 destination must be "Pune GA"');
  console.log('   ✓ Reopened Item 1.10 verified as "Pune GA" with quantity 19.');

  // Verify Item 1.08
  const reopened108 = fetchedEnq.products.find(p => String(p.itemNo) === '1.08' || String(p.itemNo) === '1.8' || String(p.itemNo) === '8');
  assert(reopened108, 'Reopened Item 1.08 not found');
  console.log(`   - Reopened Item 1.08: Qty=${reopened108.quantity}, Unit=${reopened108.unit}, Destination="${reopened108.destination}"`);
  assert.strictEqual(reopened108.quantity, 32, 'Item 1.08 quantity must be 32');
  assert.strictEqual(reopened108.destination, 'Pune, Ramanagara, Nanded & Nizamabad GAs', 'Item 1.08 destination mismatch');
  console.log('   ✓ Reopened Item 1.08 verified as "Pune, Ramanagara, Nanded & Nizamabad GAs" with quantity 32.');

  console.log('\n======================================================================');
  console.log('  ALL E2E ENQUIRY SAVE & REOPEN ASSERTIONS PASSED WITH 100% SUCCESS!');
  console.log('======================================================================');
}

runEndToEndVerification().catch(err => {
  console.error('\n❌ E2E TEST FAILED:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});

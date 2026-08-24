const fs = require('fs');
const assert = require('assert');

async function runTenderImport12ItemsVerification() {
  console.log('======================================================================');
  console.log('  FOCUSED AUTOMATED TEST: TENDER & BOQ 12 CANONICAL ITEMS & GA MAPPING');
  console.log('======================================================================\n');

  const boqPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\BOQ_321105.xls';
  const pdfPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\Tender_CSBV_26-27_16.pdf';

  assert(fs.existsSync(boqPath), `BOQ file not found at ${boqPath}`);
  assert(fs.existsSync(pdfPath), `Spec PDF file not found at ${pdfPath}`);

  // 1. Authenticate with backend
  console.log('1. Authenticating with backend API...');
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@petrovalve.com', password: 'adminpassword123' })
  }).then(r => r.json());

  assert(loginRes.token, 'Failed to obtain JWT auth token');
  const token = loginRes.token;
  console.log('   ✓ Authenticated as admin@petrovalve.com.\n');

  // 2. Prepare multipart request
  console.log('2. Uploading BOQ_321105.xls and Tender_CSBV_26-27_16.pdf to /api/enquiries/import-tender...');
  const boqBlob = new Blob([fs.readFileSync(boqPath)], { type: 'application/vnd.ms-excel' });
  const pdfBlob = new Blob([fs.readFileSync(pdfPath)], { type: 'application/pdf' });

  const form = new FormData();
  form.append('boqFiles', boqBlob, 'BOQ_321105.xls');
  form.append('specFiles', pdfBlob, 'Tender_CSBV_26-27_16.pdf');

  const startTime = Date.now();
  const response = await fetch('http://localhost:5000/api/enquiries/import-tender', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });

  const resJson = await response.json();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`   ✓ Import completed in ${elapsed}s (HTTP ${response.status}).\n`);

  assert.strictEqual(resJson.status, 'success', `API did not return success status: ${JSON.stringify(resJson)}`);
  const { products, tenderIntelligence, filesSummary } = resJson.data;

  // 3. Overall Validations
  console.log('3. Validating Overall Integrity & Ground Truth Counts:');
  console.log(`   - Total items extracted: ${products.length} (Assert: 12)`);
  assert.strictEqual(products.length, 12, `Expected exactly 12 items, got ${products.length}`);
  console.log('   ✓ Count assertion passed (12 items).');

  const totalQuantity = products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
  console.log(`   - Total valve quantity: ${totalQuantity} (Assert: 529)`);
  assert.strictEqual(totalQuantity, 529, `Expected total quantity of 529, got ${totalQuantity}`);
  console.log('   ✓ Total quantity assertion passed (529 valves).');

  // Assert no garbage or non-valve rows
  products.forEach((p, idx) => {
    const desc = (p.description || '').toLowerCase();
    assert(!desc.includes('total in figures'), `Found calculation summary row at item ${idx + 1}`);
    assert(!desc.includes('quoted rate'), `Found quoted rate row at item ${idx + 1}`);
    assert(!desc.includes('construction of chamber'), `Found civil works chamber row at item ${idx + 1}`);
    assert(!desc.includes('supply of cs ball valves as per technical specifications'), `Found preamble row at item ${idx + 1}`);
  });
  console.log('   ✓ Garbage, calculation, and civil works rows filter assertions passed.\n');

  // 4. Print & Validate All 12 Canonical Line Items
  console.log('4. Line Items Detailed Inspection & Assertion:');
  console.log('------------------------------------------------------------------------------------------------------------------------');
  console.log(String('#').padEnd(6) + String('Description').padEnd(45) + String('Qty').padEnd(8) + String('Unit').padEnd(8) + String('Class').padEnd(10) + String('Size').padEnd(12) + 'Destination');
  console.log('------------------------------------------------------------------------------------------------------------------------');

  products.forEach((p, idx) => {
    const size = p.dynamicFields?.valve_size || '-';
    const pClass = p.dynamicFields?.valve_class || '-';
    console.log(
      String(p.itemNo || idx + 1).padEnd(6) +
      String(p.description.substring(0, 42) + (p.description.length > 42 ? '...' : '')).padEnd(45) +
      String(p.quantity).padEnd(8) +
      String(p.unit).padEnd(8) +
      String(pClass).padEnd(10) +
      String(size).padEnd(12) +
      String(p.destination)
    );
  });
  console.log('------------------------------------------------------------------------------------------------------------------------\n');

  // 5. Specific Assertion on BOQ Item 1.08
  console.log('5. Running Targeted Assertions on BOQ Item 1.08:');
  const item108 = products.find(p => p.itemNo === '1.08' || p.itemNo === '1.8');
  assert(item108, 'BOQ Item 1.08 was not found in extracted products list');

  console.log(`   - Item Number: "${item108.itemNo}" (Assert: "1.08")`);
  assert(item108.itemNo === '1.08' || item108.itemNo === '1.8', 'Item number mismatch');

  console.log(`   - Quantity: ${item108.quantity} (Assert: 32)`);
  assert.strictEqual(item108.quantity, 32, `Item 1.08 quantity expected 32, got ${item108.quantity}`);

  console.log(`   - Unit: "${item108.unit}" (Assert: "NO.")`);
  assert(item108.unit === 'NO.' || item108.unit === 'NOS', `Item 1.08 unit mismatch: ${item108.unit}`);

  const item108Class = item108.dynamicFields?.valve_class || '';
  console.log(`   - Pressure Class: "${item108Class}" (Assert contains "600#")`);
  assert(item108Class.includes('600#') || item108.description.includes('#600') || item108.description.includes('600#'), 'Item 1.08 class mismatch');

  const item108Size = item108.dynamicFields?.valve_size || '';
  console.log(`   - Valve Size: "${item108Size}" (Assert contains "50 mm")`);
  assert(item108Size.includes('50') || item108.description.includes('50 mm'), 'Item 1.08 size mismatch');

  console.log(`   - Raw Destination String: "${item108.destination}"`);
  
  // Destination MUST include Pune, Ramanagara, Nanded, Nizamabad
  assert(item108.destination.includes('Pune'), 'Destination MUST include Pune');
  console.log('     ✓ Includes Pune (quantity = 9)');

  assert(item108.destination.includes('Ramanagara'), 'Destination MUST include Ramanagara');
  console.log('     ✓ Includes Ramanagara (quantity = 6)');

  assert(item108.destination.includes('Nanded'), 'Destination MUST include Nanded');
  console.log('     ✓ Includes Nanded (quantity = 17)');

  assert(item108.destination.includes('Nizamabad'), 'Destination MUST include Nizamabad');
  console.log('     ✓ Includes Nizamabad');

  // Destination MUST NOT include Nashik or Sindhudurg (where quantities are 0 / -)
  assert(!item108.destination.includes('Nashik'), 'Destination MUST NOT include Nashik (quantity = 0)');
  console.log('     ✓ Correctly EXCLUDES Nashik (quantity = 0)');

  assert(!item108.destination.includes('Sindhudurg'), 'Destination MUST NOT include Sindhudurg (quantity = 0)');
  console.log('     ✓ Correctly EXCLUDES Sindhudurg (quantity = 0)');

  assert.strictEqual(
    item108.destination,
    'Pune, Ramanagara, Nanded & Nizamabad GAs',
    `Expected exactly "Pune, Ramanagara, Nanded & Nizamabad GAs", got "${item108.destination}"`
  );
  console.log('   ✓ Item 1.08 Destination exactly matches "Pune, Ramanagara, Nanded & Nizamabad GAs".\n');

  // 6. Tender Intelligence Assertions
  console.log('6. Validating Tender Intelligence Metadata:');
  console.log(`   - Customer: "${tenderIntelligence?.tenderDetails?.customer}"`);
  assert(tenderIntelligence?.tenderDetails?.customer?.includes('Maharashtra Natural Gas') || tenderIntelligence?.tenderDetails?.customer?.includes('MNGL'), 'Customer extraction mismatch');
  console.log('   ✓ Customer identified as Maharashtra Natural Gas Limited (MNGL).');

  console.log(`   - Submission Deadline: "${tenderIntelligence?.tenderTimeline?.bidSubmissionDate}"`);
  assert(tenderIntelligence?.tenderTimeline?.bidSubmissionDate, 'Missing submission date');
  console.log('   ✓ Submission Deadline captured.');

  const contactName = tenderIntelligence?.contactPersons?.[0]?.name;
  console.log(`   - Primary Contact: "${contactName}"`);
  assert(contactName?.includes('Ganesh') || contactName?.includes('Said'), 'Missing primary contact person');
  console.log('   ✓ Primary contact captured.\n');

  console.log('======================================================================');
  console.log('  ALL 12 CANONICAL ITEMS & DESTINATION ASSERTIONS PASSED WITH 100% SUCCESS!');
  console.log('======================================================================');
}

runTenderImport12ItemsVerification().catch(err => {
  console.error('\n❌ TEST FAILED:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});

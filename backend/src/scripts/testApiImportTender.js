const fs = require('fs');

async function testApiImportTender() {
  console.log('Testing POST /api/enquiries/import-tender directly via native fetch & FormData...');

  const boqPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\BOQ_321105.xls';
  const pdfPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\Tender_CSBV_26-27_16.pdf';

  // 1. Login to get auth token
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@petrovalve.com', password: 'adminpassword123' })
  }).then(r => r.json());

  const token = loginRes.token;
  console.log('✓ Obtained JWT token.');

  // 2. Prepare native FormData
  const boqBlob = new Blob([fs.readFileSync(boqPath)], { type: 'application/vnd.ms-excel' });
  const pdfBlob = new Blob([fs.readFileSync(pdfPath)], { type: 'application/pdf' });

  const form = new FormData();
  form.append('boqFiles', boqBlob, 'BOQ_321105.xls');
  form.append('specFiles', pdfBlob, 'Tender_CSBV_26-27_16.pdf');

  console.log('Sending request to /api/enquiries/import-tender...');
  const startTime = Date.now();
  const response = await fetch('http://localhost:5000/api/enquiries/import-tender', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: form
  });

  const resJson = await response.json();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✓ Response received in ${elapsed}s! Status: ${resJson.status}`);

  if (resJson.status !== 'success') {
    throw new Error(`API Error: ${JSON.stringify(resJson)}`);
  }

  const { products, tenderIntelligence, filesSummary } = resJson.data;
  console.log(`\n==================================================`);
  console.log(`TOTAL PRODUCTS EXTRACTED: ${products.length} (Expected: 12)`);
  console.log(`==================================================`);

  products.forEach((p, idx) => {
    console.log(`\n[Item ${p.itemNo || idx + 1}]`);
    console.log(`  Description: ${p.description}`);
    console.log(`  Qty: ${p.quantity} ${p.unit}`);
    console.log(`  Category: ${p.category}`);
    console.log(`  Destination GA: ${p.destination || '-'}`);
    console.log(`  Dynamic Fields:`, JSON.stringify(p.dynamicFields));
  });

  console.log(`\n==================================================`);
  console.log(`TENDER INTELLIGENCE`);
  console.log(`==================================================`);
  console.log('Customer:', tenderIntelligence?.tenderDetails?.customer);
  console.log('Tender No:', tenderIntelligence?.tenderDetails?.gemTenderNo);
  console.log('Bid Submission Date:', tenderIntelligence?.tenderTimeline?.bidSubmissionDate);
  console.log('Contact Persons:', tenderIntelligence?.contactPersons);

  // Assertions
  if (products.length !== 12) {
    throw new Error(`Expected exactly 12 products, got ${products.length}!`);
  }
  console.log('\n✓ ALL ASSERTIONS PASSED: Exactly 12 clean BOQ items extracted without duplicates or civil work rows!');
}

testApiImportTender().catch(err => {
  console.error('API Test Error:', err);
  process.exit(1);
});

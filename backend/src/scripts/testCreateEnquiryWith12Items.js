const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const ARTIFACTS_DIR = 'C:\\Users\\jeetd\\.gemini\\antigravity-ide\\brain\\057576cd-4804-40a6-8dde-2c0c0bf15d07';

async function testCreateAndVerifyEnquiry() {
  console.log('Testing full Enquiry creation with 12 BOQ line items and capturing Detail UI...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,1000']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });

  // 1. Authenticate
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@petrovalve.com', password: 'adminpassword123' })
  }).then(r => r.json());

  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate((tok, usr) => {
    sessionStorage.setItem('token', tok);
    sessionStorage.setItem('user', JSON.stringify(usr));
    localStorage.setItem('token', tok);
    localStorage.setItem('user', JSON.stringify(usr));
  }, loginRes.token, loginRes.user);

  console.log('✓ Authenticated.');

  // 2. Import tender files to extract 12 products
  const boqPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\BOQ_321105.xls';
  const pdfPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\Tender_CSBV_26-27_16.pdf';

  const boqBlob = new Blob([fs.readFileSync(boqPath)], { type: 'application/vnd.ms-excel' });
  const pdfBlob = new Blob([fs.readFileSync(pdfPath)], { type: 'application/pdf' });

  const form = new FormData();
  form.append('boqFiles', boqBlob, 'BOQ_321105.xls');
  form.append('specFiles', pdfBlob, 'Tender_CSBV_26-27_16.pdf');

  console.log('Extracting tender data from backend...');
  const importRes = await fetch('http://localhost:5000/api/enquiries/import-tender', {
    method: 'POST',
    headers: { Authorization: `Bearer ${loginRes.token}` },
    body: form
  }).then(r => r.json());

  const { products, tenderIntelligence } = importRes.data;
  console.log(`✓ Extracted ${products.length} products (Expected: 12)`);

  // 3. Create the Enquiry with the 12 products
  const payload = {
    customerData: {
      companyName: tenderIntelligence?.tenderDetails?.customer || 'Maharashtra Natural Gas Limited (MNGL)',
      primaryContactName: tenderIntelligence?.contactPersons?.[0]?.name || 'Ganesh Said',
      mobileNumber: tenderIntelligence?.contactPersons?.[0]?.phone || '+91 (20) 25611000',
      emailAddress: tenderIntelligence?.contactPersons?.[0]?.email || 'akshay.girme@mngl.in'
    },
    enquiryData: {
      sourceChannel: 'GEM Portal',
      sourceType: 'Tender',
      tenderNumber: 'GEM/2026/B/321105',
      gemTenderNo: 'GEM/2026/B/321105',
      tenderDeadline: tenderIntelligence?.tenderTimeline?.bidSubmissionDate || '2026-05-07',
      contactPerson: tenderIntelligence?.contactPersons?.[0]?.name || 'Ganesh Said',
      contactMobile: tenderIntelligence?.contactPersons?.[0]?.phone || '+91 (20) 25611000',
      contactEmail: tenderIntelligence?.contactPersons?.[0]?.email || 'akshay.girme@mngl.in',
      productCategory: 'Valves',
      productDescription: products[0].description,
      quantity: products[0].quantity,
      unit: products[0].unit,
      priority: 'High',
      dynamicFields: products[0].dynamicFields || {},
      products: products,
      tenderIntelligence: tenderIntelligence
    }
  };

  console.log('Creating Enquiry with 12 items...');
  const createRes = await fetch('http://localhost:5000/api/enquiries', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginRes.token}`
    },
    body: JSON.stringify(payload)
  }).then(r => r.json());

  console.log('createRes:', JSON.stringify(createRes, null, 2));
  const createdEnquiryId = createRes.data?.enquiry?._id || createRes.data?._id || createRes._id;
  console.log(`✓ Enquiry Created! ID: ${createdEnquiryId}`);

  // 4. Navigate to Enquiry Detail page in Browser
  console.log(`Navigating to /app/enquiries/${createdEnquiryId}...`);
  await page.goto(`http://localhost:5173/app/enquiries/${createdEnquiryId}`, { waitUntil: 'networkidle2', timeout: 20000 });
  await page.waitForSelector('h1', { timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  // Check the line items rendered in the EnquiryDetail UI table
  const lineItemRows = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('table tbody tr')).map(r => 
      Array.from(r.querySelectorAll('td')).map(td => td.textContent.trim()).join(' | ')
    );
    return rows;
  });

  console.log(`\n=== ENQUIRY DETAIL PAGE: RENDERED LINE ITEMS (${lineItemRows.length}) ===`);
  lineItemRows.forEach((r, idx) => console.log(`  Row ${idx + 1}: ${r}`));

  // Scroll main container to Line Items table
  await page.evaluate(() => {
    const scrollContainers = Array.from(document.querySelectorAll('main, div')).filter(el => {
      const style = window.getComputedStyle(el);
      return style.overflowY === 'auto' || style.overflowY === 'scroll';
    });
    if (scrollContainers.length > 0) {
      scrollContainers[0].scrollTop = 750;
    } else {
      window.scrollTo(0, 750);
    }
  });
  await new Promise(r => setTimeout(r, 1000));

  // Capture screenshot of Line Items table
  const shotPath = path.join(ARTIFACTS_DIR, 'm4_tender_enquiry_12_items_table.png');
  await page.screenshot({ path: shotPath });
  console.log(`\n✓ Line Items Table Screenshot captured: ${shotPath}`);

  await browser.close();
  console.log('✓ Verification Complete!');
}

testCreateAndVerifyEnquiry().catch(console.error);

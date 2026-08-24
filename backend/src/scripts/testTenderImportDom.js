const path = require('path');
const puppeteer = require('puppeteer');
const fs = require('fs');

async function testTenderImport() {
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

  // 2. Navigate to Enquiries
  await page.goto('http://localhost:5173/app/enquiries', { waitUntil: 'networkidle2', timeout: 20000 });
  await page.waitForSelector('button', { timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));

  console.log('Page Title:', await page.title());
  console.log('Page URL:', page.url());

  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
  });
  console.log('Buttons on page:', buttons);

  // Click "+ New Enquiry" or any button containing "New Enquiry"
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.includes('New Enquiry') || b.textContent.includes('Enquiry'));
    if (btn) btn.click();
    else console.error('No button found');
  });

  await new Promise(r => setTimeout(r, 1500));

  // Expand "Import from Tender Files"
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.includes('Import from Tender Files') || b.textContent.includes('Tender Files'));
    if (btn) btn.click();
  });

  await new Promise(r => setTimeout(r, 1000));

  const boqPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\BOQ_321105.xls';
  const pdfPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\Tender_CSBV_26-27_16.pdf';

  const fileInputs = await page.$$('input[type="file"]');
  console.log(`Found ${fileInputs.length} file inputs`);

  if (fileInputs.length >= 2) {
    await fileInputs[0].uploadFile(boqPath);
    console.log('✓ Attached BOQ_321105.xls');
    await new Promise(r => setTimeout(r, 800));

    await fileInputs[1].uploadFile(pdfPath);
    console.log('✓ Attached Tender_CSBV_26-27_16.pdf');
  }

  await new Promise(r => setTimeout(r, 1000));

  // Intercept alert
  page.on('dialog', async dialog => {
    console.log('Alert dialog:', dialog.message());
    await dialog.accept();
  });

  console.log('Clicking "Run AI Import"...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const runBtn = btns.find(b => b.textContent.includes('Run AI Import'));
    if (runBtn) runBtn.click();
  });

  // Wait for table to appear
  console.log('Waiting for extraction and DOM update...');
  await page.waitForFunction(() => {
    return document.body.innerText.includes('Extracted BOQ Line Items');
  }, { timeout: 90000 });

  await new Promise(r => setTimeout(r, 2000));

  const tableSummary = await page.evaluate(() => {
    const heading = document.querySelector('h4')?.textContent || '';
    const rows = Array.from(document.querySelectorAll('table tbody tr')).map(r => 
      Array.from(r.querySelectorAll('td')).map(td => td.textContent.trim()).join(' | ')
    );
    return { heading, count: rows.length, rows };
  });

  console.log('\n=== BROWSER EXTRACTION RESULT ===');
  console.log('Heading:', tableSummary.heading);
  console.log('Total extracted rows in modal:', tableSummary.count);
  tableSummary.rows.forEach(r => console.log('  >', r));

  const shotPath = 'C:\\Users\\jeetd\\.gemini\\antigravity-ide\\brain\\057576cd-4804-40a6-8dde-2c0c0bf15d07\\m4_tender_import_12_items_verified.png';
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log(`\n✓ Screenshot saved: ${shotPath}`);

  await browser.close();
}

testTenderImport().catch(console.error);

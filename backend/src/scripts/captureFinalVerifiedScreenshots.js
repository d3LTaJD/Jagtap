const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function capture() {
  console.log('Capturing verified screenshots...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,1100']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100 });

  page.on('dialog', async dialog => {
    await dialog.accept();
  });

  try {
    // 1. Login
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[name="mobile_number"]');
    await page.type('input[name="mobile_number"]', 'admin@petrovalve.com');
    await page.type('input[type="password"]', 'adminpassword123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // 2. Go to Enquiries
    await page.goto('http://localhost:5173/app/enquiries', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));

    // 3. Click New Enquiry button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText.includes('New Enquiry'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // 4. Upload BOQ & PDF files
    const boqPath = path.resolve('d:/jagtap/A002_MNGL_26-27-20260624T190541Z-3-001/A002_MNGL_26-27/BOQ_321105.xls');
    const pdfPath = path.resolve('d:/jagtap/A002_MNGL_26-27-20260624T190541Z-3-001/A002_MNGL_26-27/Tender_CSBV_26-27_16.pdf');

    const fileInputs = await page.$$('input[type="file"]');
    if (fileInputs.length >= 2) {
      await fileInputs[0].uploadFile(boqPath);
      await fileInputs[1].uploadFile(pdfPath);
    }
    await new Promise(r => setTimeout(r, 1000));

    // 5. Click "Run AI Import" button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText.includes('Run AI Import'));
      if (btn) btn.click();
    });

    // Wait for tender import response
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes('Tender BOQ Summary') || text.includes('12 Canonical Items');
    }, { timeout: 120000 });

    await new Promise(r => setTimeout(r, 2000));

    // Scroll inside the modal dialog to show the Tender BOQ Summary and Line Items Table
    await page.evaluate(() => {
      const form = document.querySelector('form#new-enquiry-form');
      if (form && form.parentElement) {
        form.parentElement.scrollTop = 700;
      }
    });
    await new Promise(r => setTimeout(r, 1500));

    // Capture screenshot of the modal with Tender BOQ Summary & Line Items Table in full view
    const modalScreenshotPath = 'C:\\Users\\jeetd\\.gemini\\antigravity-ide\\brain\\057576cd-4804-40a6-8dde-2c0c0bf15d07\\m4_tender_import_modal_verified.png';
    await page.screenshot({ path: modalScreenshotPath });
    console.log(`Saved modal screenshot to ${modalScreenshotPath}`);

    // Fill customer fields
    await page.evaluate(() => {
      const companyInput = document.querySelector('input[placeholder="Acme Corp"]') || document.querySelector('input[placeholder*="Company"]');
      if (companyInput && !companyInput.value) {
        companyInput.value = 'Maharashtra Natural Gas Limited (MNGL)';
        companyInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const contactInput = document.querySelector('input[placeholder="John Doe"]') || document.querySelector('input[placeholder*="Contact Person"]');
      if (contactInput && !contactInput.value) {
        contactInput.value = 'Ganesh Said';
        contactInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const mobileInput = document.querySelector('input[placeholder="9876543210"]') || document.querySelector('input[placeholder*="Mobile"]');
      if (mobileInput && !mobileInput.value) {
        mobileInput.value = '+91 (20) 25611000';
        mobileInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const emailInput = document.querySelector('input[placeholder="john@acme.com"]') || document.querySelector('input[placeholder*="Email"]');
      if (emailInput && !emailInput.value) {
        emailInput.value = 'gasald@mngl.in';
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    await new Promise(r => setTimeout(r, 800));

    // 6. Click Save Enquiry
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText.trim() === 'Save Enquiry');
      if (btn) btn.click();
    });

    // Wait for modal to close and table to refresh
    await new Promise(r => setTimeout(r, 4500));

    // 7. Click on the first enquiry in the table to open detail view
    await page.waitForSelector('table tbody tr');
    const firstRow = await page.$('table tbody tr');
    if (firstRow) {
      await firstRow.click();
    }

    await new Promise(r => setTimeout(r, 3500));

    // Capture screenshot of the Detail Page (Header & Summary)
    const detailScreenshotPath = 'C:\\Users\\jeetd\\.gemini\\antigravity-ide\\brain\\057576cd-4804-40a6-8dde-2c0c0bf15d07\\m4_tender_enquiry_12_items_detail.png';
    await page.screenshot({ path: detailScreenshotPath });
    console.log(`Saved detail page screenshot to ${detailScreenshotPath}`);

    // Scroll down to the Line Items table
    await page.evaluate(() => {
      window.scrollTo(0, 750);
    });
    await new Promise(r => setTimeout(r, 1500));

    const tableScreenshotPath = 'C:\\Users\\jeetd\\.gemini\\antigravity-ide\\brain\\057576cd-4804-40a6-8dde-2c0c0bf15d07\\m4_tender_enquiry_12_items_table.png';
    await page.screenshot({ path: tableScreenshotPath });
    console.log(`Saved table screenshot to ${tableScreenshotPath}`);

    console.log('Done!');
  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
}

capture();

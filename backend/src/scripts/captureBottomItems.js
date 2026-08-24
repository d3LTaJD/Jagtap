const puppeteer = require('puppeteer');
const path = require('path');

async function captureBottom() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,1100']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100 });

  try {
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[name="mobile_number"]');
    await page.type('input[name="mobile_number"]', 'admin@petrovalve.com');
    await page.type('input[type="password"]', 'adminpassword123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    await page.goto('http://localhost:5173/app/enquiries', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));

    await page.waitForSelector('table tbody tr');
    const firstRow = await page.$('table tbody tr');
    if (firstRow) {
      await firstRow.click();
    }
    await new Promise(r => setTimeout(r, 3000));

    // Scroll down to the bottom of the Line Items table to view items 1.07 to 1.12
    await page.evaluate(() => {
      window.scrollTo(0, 1100);
    });
    await new Promise(r => setTimeout(r, 1500));

    const tableBottomScreenshot = 'C:\\Users\\jeetd\\.gemini\\antigravity-ide\\brain\\057576cd-4804-40a6-8dde-2c0c0bf15d07\\m4_tender_enquiry_12_items_table_bottom.png';
    await page.screenshot({ path: tableBottomScreenshot });
    console.log(`Saved table bottom screenshot to ${tableBottomScreenshot}`);
  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
}

captureBottom();

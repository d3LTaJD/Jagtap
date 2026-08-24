const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const puppeteer = require('puppeteer');

const ARTIFACTS_DIR = 'C:\\Users\\jeetd\\.gemini\\antigravity-ide\\brain\\057576cd-4804-40a6-8dde-2c0c0bf15d07';

async function testAndCaptureWorkOrdersUi() {
  console.log('================================================================================');
  console.log('PETROVALVE WORK ORDERS REDESIGNED UI/UX BROWSER CAPTURE');
  console.log('================================================================================\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,1000']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });

  try {
    // 1. Authenticate with real backend API
    console.log('1. Setting up credentials and authenticating session...');
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@petrovalve.com', password: 'adminpassword123' })
    }).then(r => r.json());

    if (!loginRes.token) {
      throw new Error(`Login failed: ${loginRes.message}`);
    }

    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });

    await page.evaluate((tok, usr) => {
      sessionStorage.setItem('token', tok);
      sessionStorage.setItem('user', JSON.stringify(usr));
      localStorage.setItem('token', tok);
      localStorage.setItem('user', JSON.stringify(usr));
    }, loginRes.token, loginRes.user);

    console.log('✓ Authenticated real session.');

    // 2. Navigate to Work Orders Module
    console.log('2. Navigating to Work Orders Module...');
    await page.goto('http://localhost:5173/app/work-orders', { waitUntil: 'networkidle2', timeout: 20000 });
    await page.waitForSelector('h1', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));

    const shotPath = path.join(ARTIFACTS_DIR, 'm4_work_orders_redesigned.png');
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`✓ Work Orders screenshot captured: ${shotPath}`);

    console.log('\n================================================================================');
    console.log('WORK ORDERS UI/UX CAPTURE COMPLETE');
    console.log('================================================================================\n');
  } catch (err) {
    console.error('Error during capture:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testAndCaptureWorkOrdersUi();

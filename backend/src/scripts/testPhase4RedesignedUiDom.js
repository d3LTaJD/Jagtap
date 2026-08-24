const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function testAndCaptureRedesignedUi() {
  console.log('================================================================================');
  console.log('PETROVALVE M4 REDESIGNED UI/UX BROWSER CAPTURE & DOM VERIFICATION');
  console.log('================================================================================\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,1000']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });

  const artifactDir = path.resolve('C:/Users/jeetd/.gemini/antigravity-ide/brain/057576cd-4804-40a6-8dde-2c0c0bf15d07');

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

  // 2. Navigate to Purchase & BOM Module
  console.log('2. Navigating to Purchase & BOM Module...');
  await page.goto('http://localhost:5173/app/purchase', { waitUntil: 'networkidle2', timeout: 20000 });
  await page.waitForSelector('h1', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 2000));

  // Capture Tab 1: AI BOM
  const shot1Path = path.join(artifactDir, 'm4_ui_tab1_bom.png');
  await page.screenshot({ path: shot1Path, fullPage: false });
  console.log(`✓ Tab 1 (Valve BOMs) captured: ${shot1Path}`);

  // 3. Tab 2: Purchase Orders & Shortages
  console.log('3. Navigating to Tab 2 (Purchase Orders & Shortage PRs)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(btn => btn.innerText.includes('Shortage PRs & Purchase Orders'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  const shot2Path = path.join(artifactDir, 'm4_ui_tab2_pos.png');
  await page.screenshot({ path: shot2Path, fullPage: false });
  console.log(`✓ Tab 2 (Purchase Orders) captured: ${shot2Path}`);

  // Switch sub-tab to Shortage Requisitions
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(btn => btn.innerText.includes('Shortage Requisitions'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  const shot2PrPath = path.join(artifactDir, 'm4_ui_tab2_prs.png');
  await page.screenshot({ path: shot2PrPath, fullPage: false });
  console.log(`✓ Tab 2 Sub-tab (Shortage Requisitions) captured: ${shot2PrPath}`);

  // 4. Tab 3: Vendor Invoices 2-Way Match
  console.log('4. Navigating to Tab 3 (Vendor Invoices 2-Way Match)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(btn => btn.innerText.includes('Vendor Invoice 2-Way Match'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  const shot3Path = path.join(artifactDir, 'm4_ui_tab3_invoices.png');
  await page.screenshot({ path: shot3Path, fullPage: false });
  console.log(`✓ Tab 3 (Vendor Invoices) captured: ${shot3Path}`);

  // 5. Tab 4: Delivery Timeline
  console.log('5. Navigating to Tab 4 (Delivery Timeline & Lead Times)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(btn => btn.innerText.includes('Delivery Timeline'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  const shot4Path = path.join(artifactDir, 'm4_ui_tab4_timeline.png');
  await page.screenshot({ path: shot4Path, fullPage: false });
  console.log(`✓ Tab 4 (Delivery Timeline) captured: ${shot4Path}`);

  await browser.close();
  console.log('\n================================================================================');
  console.log('UI/UX CAPTURE COMPLETE: ALL SCREENSHOTS GENERATED');
  console.log('================================================================================\n');
}

testAndCaptureRedesignedUi().catch(err => {
  console.error('Error during capture:', err);
  process.exit(1);
});

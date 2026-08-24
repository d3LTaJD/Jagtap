const puppeteer = require('puppeteer');

async function debugEnquiriesPage() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // Authenticate
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

  await page.goto('http://localhost:5173/app/enquiries', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  const bodyHtml = await page.evaluate(() => document.body.innerHTML);
  console.log('HTML snippet:', bodyHtml.slice(0, 1000));

  await browser.close();
}

debugEnquiriesPage().catch(console.error);

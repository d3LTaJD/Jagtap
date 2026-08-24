const fs = require('fs');
const pdfParse = require('pdf-parse');

async function test() {
  const pdfPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\Tender_CSBV_26-27_16.pdf';
  const data = await pdfParse(fs.readFileSync(pdfPath));
  const lines = data.text.split(/\r?\n/);
  
  lines.forEach((l, i) => {
    if (/pune|ramanagara|nanded|nizamabad|sindhudurg/i.test(l)) {
      console.log(`Line ${i}: ${l}`);
    }
  });
}

test().catch(console.error);

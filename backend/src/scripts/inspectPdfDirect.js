const fs = require('fs');
const pdfParseModule = require('pdf-parse');

async function test() {
  const pdfPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\Tender_CSBV_26-27_16.pdf';
  const buf = fs.readFileSync(pdfPath);
  const parser = new pdfParseModule.PDFParse({ data: buf });
  const result = await parser.getText();
  const text = result.text || '';
  
  const lines = text.split(/\r?\n/);
  console.log(`Extracted ${lines.length} lines.`);
  lines.forEach((l, i) => {
    if (/pune|ramanagara|nanded|nizamabad|sindhudurg|schedule of rates|ga distribution|geographical/i.test(l)) {
      console.log(`Line ${i}: ${l}`);
    }
  });

  const boqParserService = require('../services/boqParserService');
  const gaMap = boqParserService.extractGaDistributionFromText(text);
  console.log('\n--- EXTRACTED GA MAP ---');
  for (const [k, v] of gaMap.entries()) {
    console.log(`  Key "${k}" => "${v}"`);
  }
}

test().catch(console.error);

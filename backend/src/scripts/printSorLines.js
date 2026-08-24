const fs = require('fs');
const pdfParseModule = require('pdf-parse');

async function printSorLines() {
  const pdfPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\Tender_CSBV_26-27_16.pdf';
  const buf = fs.readFileSync(pdfPath);
  
  const parser = new pdfParseModule.PDFParse({ data: buf });
  await parser.load();
  const res = await parser.getText();
  const text = res.text || '';
  const lines = text.split(/\r?\n/);

  console.log('=== SECTION 1: Lines 4660 to 4720 ===');
  for (let i = 4660; i <= 4720; i++) {
    console.log(`[${i}] ${lines[i]}`);
  }

  console.log('\n=== SECTION 2: Lines 5920 to 5980 ===');
  for (let i = 5920; i <= 5980; i++) {
    console.log(`[${i}] ${lines[i]}`);
  }
}

printSorLines().catch(console.error);

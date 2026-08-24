const fs = require('fs');
const pdfParseModule = require('pdf-parse');

async function searchPdf() {
  const pdfPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\Tender_CSBV_26-27_16.pdf';
  const buf = fs.readFileSync(pdfPath);
  
  const parser = new pdfParseModule.PDFParse({ data: buf });
  await parser.load();
  const res = await parser.getText();
  const text = res.text || '';
  console.log(`PDF Text length: ${text.length}`);

  const lines = text.split(/\r?\n/);
  console.log(`Total lines: ${lines.length}`);

  lines.forEach((line, idx) => {
    if (/1\.08/i.test(line) || (/50\s*mm/i.test(line) && /600/i.test(line))) {
      console.log(`\n--- Match around Line ${idx}: ${line} ---`);
      for (let j = Math.max(0, idx - 4); j <= Math.min(lines.length - 1, idx + 10); j++) {
        console.log(`  [${j}] ${lines[j]}`);
      }
    }
  });
}

searchPdf().catch(console.error);

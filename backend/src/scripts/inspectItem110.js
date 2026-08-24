const fs = require('fs');
const XLSX = require('xlsx');
const pdfParseModule = require('pdf-parse');

async function inspectItem110() {
  const boqPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\BOQ_321105.xls';
  const pdfPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\Tender_CSBV_26-27_16.pdf';

  console.log('=== BOQ EXCEL ROWS ===');
  const wb = XLSX.read(fs.readFileSync(boqPath), { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  
  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r];
    const rowStr = JSON.stringify(row);
    if (rowStr.includes('1.10') || rowStr.includes('1.1') || rowStr.includes('19')) {
      console.log(`Excel Row ${r}:`, row);
    }
  }

  console.log('\n=== TENDER PDF MATCHES ===');
  const pdfBuf = fs.readFileSync(pdfPath);
  const parser = new pdfParseModule.PDFParse({ data: pdfBuf });
  await parser.load();
  const res = await parser.getText();
  const text = res.text || '';
  const lines = text.split(/\r?\n/).map(l => l.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('1.10') || line.includes('19 - -') || (line.includes('50 mm') && line.includes('#150'))) {
      console.log(`PDF Line ${i}:`, line);
      for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 5); j++) {
        console.log(`   [${j}] ${lines[j]}`);
      }
    }
  }
}

inspectItem110().catch(console.error);

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const fileParsingService = require('../services/fileParsingService');

const boqPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\BOQ_321105.xls';
const pdfPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\Tender_CSBV_26-27_16.pdf';

async function testExtraction() {
  console.log('=== 1. BOQ EXCEL PARSING ===');
  const boqBuf = fs.readFileSync(boqPath);
  const workbook = XLSX.read(boqBuf, { type: 'buffer' });
  let boqProducts = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);
    console.log(`Sheet "${sheetName}": ${rows.length} JSON rows`);
    rows.forEach((r, idx) => {
      console.log(`Row ${idx}:`, r);
    });
  }

  console.log('\n=== 2. PDF PARSING ===');
  const pdfBuf = fs.readFileSync(pdfPath);
  const pdfResult = await fileParsingService.extractTextFromFile(pdfBuf, 'application/pdf', 'Tender_CSBV_26-27_16.pdf');
  console.log(`PDF text status: ${pdfResult.status}, length: ${pdfResult.text?.length}`);
  
  // Let's see what rawLines would match
  const rawLines = pdfResult.text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 5 && /\b(valve|gate|ball|globe|check|butterfly|plug|pipe|flange)\b/i.test(l));
  console.log(`Raw PDF matching lines: ${rawLines.length}`);
  rawLines.forEach((l, i) => {
    if (i < 20) console.log(`Line ${i}: ${l}`);
  });
}

testExtraction().catch(console.error);

const XLSX = require('xlsx');
const fs = require('fs');

const boqPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\BOQ_321105.xls';
const buf = fs.readFileSync(boqPath);
const wb = XLSX.read(buf, { type: 'buffer' });
const sheet = wb.Sheets['BoQ1'];
const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log('--- ALL COLUMNS OF ROW 10 (Headers) ---');
matrix[10].forEach((col, idx) => {
  if (col !== '') console.log(`Col ${idx}: "${col}"`);
});

console.log('\n--- ALL COLUMNS OF ROW 20 (Item 1.08) ---');
matrix[20].forEach((col, idx) => {
  if (col !== '') console.log(`Col ${idx}: "${col}"`);
});

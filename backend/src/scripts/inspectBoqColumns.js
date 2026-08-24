const XLSX = require('xlsx');
const fs = require('fs');

const boqPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\BOQ_321105.xls';
const buf = fs.readFileSync(boqPath);
const wb = XLSX.read(buf, { type: 'buffer' });

console.log('Sheet Names:', wb.SheetNames);
const sheet = wb.Sheets[wb.SheetNames[0]];
const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log(`Total rows: ${matrix.length}`);

// Print rows 8 to 25 with column indices
for (let r = 8; r < Math.min(matrix.length, 26); r++) {
  const row = matrix[r];
  const nonEmpties = row.map((val, idx) => ({ idx, val })).filter(c => String(c.val).trim() !== '');
  console.log(`\nRow ${r}:`);
  nonEmpties.forEach(c => console.log(`  Col ${c.idx}: "${c.val}"`));
}

const XLSX = require('xlsx');
const fs = require('fs');

const boqPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\BOQ_321105.xls';
const buf = fs.readFileSync(boqPath);
const wb = XLSX.read(buf, { type: 'buffer' });

for (const name of wb.SheetNames) {
  console.log('=== SHEET:', name, '===');
  const sheet = wb.Sheets[name];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  for (let r = 0; r < Math.min(matrix.length, 14); r++) {
    const nonEmpties = matrix[r].map((v, i) => ({ i, v })).filter(c => String(c.v).trim() !== '');
    if (nonEmpties.length > 0) {
      console.log(`Row ${r}:`, nonEmpties.map(c => `[${c.i}] ${c.v}`).join(' | '));
    }
  }
}

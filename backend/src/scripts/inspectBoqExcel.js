const fs = require('fs');
const XLSX = require('xlsx');

const boqPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\BOQ_321105.xls';
const wb = XLSX.read(fs.readFileSync(boqPath), { type: 'buffer' });

for (const name of wb.SheetNames) {
  console.log(`\n=== SHEET: ${name} ===`);
  const sheet = wb.Sheets[name];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  matrix.slice(0, 30).forEach((row, idx) => {
    const filled = row.map((c, i) => (c !== '' ? `[Col ${i}: ${JSON.stringify(c)}]` : '')).filter(Boolean);
    if (filled.length > 0) {
      console.log(`Row ${idx + 1}: ${filled.join(' ')}`);
    }
  });
}

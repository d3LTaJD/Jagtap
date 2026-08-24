const XLSX = require('xlsx');
const fs = require('fs');

const boqPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\BOQ_321105.xls';
const buf = fs.readFileSync(boqPath);
const wb = XLSX.read(buf, { type: 'buffer' });
const sheet = wb.Sheets['BoQ1'];
const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

// Look for any text mentioning Pune, Nashik, Sindhudurg, Ramanagara, Nanded, Nizamabad, or numbers across ALL columns in the sheet
for (let r = 0; r < matrix.length; r++) {
  const row = matrix[r];
  for (let c = 0; c < row.length; c++) {
    const val = String(row[c]).trim();
    if (val && /pune|nashik|sindhudurg|ramanagara|nanded|nizamabad/i.test(val)) {
      console.log(`Match at Row ${r}, Col ${c}: "${val}"`);
    }
  }
}

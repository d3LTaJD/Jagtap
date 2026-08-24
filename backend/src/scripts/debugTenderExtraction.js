const fs = require('fs');
const boqParserService = require('../services/boqParserService');
const fileParsingService = require('../services/fileParsingService');

async function test() {
  const boqPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\BOQ_321105.xls';
  const pdfPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\Tender_CSBV_26-27_16.pdf';

  const boqBuf = fs.readFileSync(boqPath);
  const pdfBuf = fs.readFileSync(pdfPath);

  console.log('1. Parsing Excel BOQ...');
  const products = boqParserService.parseExcelBOQ(boqBuf);
  console.log('Extracted products:', products.map(p => ({ itemNo: p.itemNo, desc: p.description?.substring(0, 30), destination: p.destination })));

  console.log('\n2. Extracting PDF text...');
  const parseResult = await fileParsingService.extractTextFromFile(pdfBuf, 'application/pdf', 'Tender_CSBV_26-27_16.pdf');
  console.log('PDF text length:', parseResult.text.length);

  console.log('\n3. Extracting GA distribution from PDF text...');
  const gaMap = boqParserService.extractGaDistributionFromText(parseResult.text);
  console.log('GA Map entries:');
  for (const [k, v] of gaMap.entries()) {
    console.log(`  Key: "${k}" -> "${v}"`);
  }

  console.log('\n4. Applying GA destinations to products...');
  products.forEach(p => {
    const rawNo = String(p.itemNo || '').trim();
    const destFromGa = gaMap.get(rawNo) || 
                       gaMap.get(rawNo.replace(/^1\./, '')) || 
                       (rawNo.startsWith('1.') ? gaMap.get(rawNo) : gaMap.get(`1.${rawNo.padStart(2, '0')}`));
    if (destFromGa) {
      p.destination = destFromGa;
    }
  });

  console.log('\nFinal products with destinations:');
  products.forEach(p => {
    console.log(`  Item ${p.itemNo}: Qty=${p.quantity} -> Destination: "${p.destination}"`);
  });
}

test().catch(console.error);

const fs = require('fs');
const pdfParseModule = require('pdf-parse');
const { extractGaDistributionFromText } = require('../services/boqParserService');

async function traceGaMap() {
  const pdfPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\Tender_CSBV_26-27_16.pdf';
  const pdfBuf = fs.readFileSync(pdfPath);
  const parser = new pdfParseModule.PDFParse({ data: pdfBuf });
  await parser.load();
  const res = await parser.getText();
  const text = res.text || '';

  const gaMap = extractGaDistributionFromText(text);
  console.log('=== TRACE ALL KEYS IN gaMap ===');
  for (const [k, v] of gaMap.entries()) {
    console.log(`Key: "${k}" -> Value: "${v}"`);
  }
}

traceGaMap().catch(console.error);

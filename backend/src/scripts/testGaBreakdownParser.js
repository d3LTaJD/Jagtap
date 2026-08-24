const fs = require('fs');
const pdfParseModule = require('pdf-parse');

async function testGaBreakdownParser() {
  const pdfPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\Tender_CSBV_26-27_16.pdf';
  const buf = fs.readFileSync(pdfPath);
  
  const parser = new pdfParseModule.PDFParse({ data: buf });
  await parser.load();
  const res = await parser.getText();
  const text = res.text || '';

  console.log('=== TESTING DYNAMIC GA BREAKDOWN EXTRACTION FROM TEXT ===\n');

  // Let's find lines with GA headers and line items
  // Look for header line containing multiple GA names or locations
  // e.g. "Pune Nashik Sindhudurg Ramanagara Nanded Nizamabad"
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  let gaHeaders = [];
  let headerIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check if line contains 2 or more known or capitalized location/city words
    const words = line.split(/[\t\s|,]+/).map(w => w.trim()).filter(w => w.length > 2);
    // If line has words like (No.) Pune Nashik Sindhudurg...
    const gaCandidates = words.filter(w => !/quantities|quantity|nos|no\.|\(no\.\)|total|item|sl|sr|rates|schedule/i.test(w));
    if (gaCandidates.length >= 3 && /pune|mumbai|delhi|nashik|nanded|surat|chennai|hyderabad|bangalore|ramanagara|sindhudurg|nizamabad|site|ga|plant|location|project/i.test(line)) {
      gaHeaders = gaCandidates;
      headerIndex = i;
      console.log(`Found GA Header at line ${i}:`, gaHeaders);
      break;
    }
  }

  console.log('Detected GA Columns:', gaHeaders);

  // Now parse items following or across the document
  const itemGaMap = new Map();

  // Pattern for item lines: e.g. "1.08 Valve... 9 0 - 6 17 32" or "1 Valve... 10 - - - 4 2 16"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match item prefix: e.g. 1.01, 1.02, 1.08, or 1, 2, ...
    const itemMatch = line.match(/^(\d+(?:\.\d+)?)\s*(.*)/);
    if (itemMatch) {
      const itemNum = itemMatch[1];
      // Search the line or subsequent 2 lines for numbers / dashes corresponding to GA counts
      // Let's collect numbers and dashes from line and next 2 lines
      const contextLines = [line, lines[i+1] || '', lines[i+2] || ''].join(' ');
      
      // Look for a sequence of numbers/dashes matching the number of GA headers
      // e.g. "9 0 - 6 17 32" or "10 - - - 4 2 16"
      const numberMatches = contextLines.match(/(\b(?:\d+|-)\b\s+){3,}\b(?:\d+|-)\b/g);
      if (numberMatches) {
        console.log(`Item ${itemNum}: found count sequence: "${numberMatches[0]}"`);
      }
    }
  }
}

testGaBreakdownParser().catch(console.error);

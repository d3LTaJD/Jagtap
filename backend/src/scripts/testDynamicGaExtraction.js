const fs = require('fs');
const pdfParseModule = require('pdf-parse');

function formatDestinationList(names) {
  if (!names || !Array.isArray(names) || names.length === 0) return '';
  const clean = names.map(n => String(n).trim().replace(/\s+(GA|GAs|Site|Sites)$/i, '')).filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length === 1) return `${clean[0]} GA`;
  if (clean.length === 2) return `${clean[0]} & ${clean[1]} GAs`;
  const allButLast = clean.slice(0, -1).join(', ');
  return `${allButLast} & ${clean[clean.length - 1]} GAs`;
}

/**
 * Known non-geographical words commonly found in tender document titles/headers.
 */
const NON_GA_WORDS = new Set([
  'quoted', 'not', 'sr', 'no', 'total', 'quantity', 'quantities', 'item', 'description',
  'schedule', 'rates', 'sl', 'geographical', 'areas', 'area', 'valve', 'valves', 'ball',
  'gate', 'globe', 'check', 'butterfly', 'plug', 'cs', 'ss', 'bw', 'sw', 'fb', 'ug',
  'technical', 'specification', 'specifications', 'painting', 'marking', 'service', 'natural',
  'material', 'materials', 'part', 'parts', 'specified', 'equivalent', 'standard', 'document',
  'documents', 'tender', 'contract', 'section', 'annexure', 'scope', 'supply', 'delivery',
  'price', 'rate', 'amount', 'unit', 'units', 'code', 'make', 'type', 'size', 'class', 'rating'
]);

function extractGaDistributionFromText(text) {
  if (!text) return new Map();

  const lines = text.split(/\r?\n/).map(l => l.trim());
  const itemGaMap = new Map();

  // Find genuine GA header lines throughout the document
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    const tokens = line.split(/[\t\s|,]+/).map(t => t.trim()).filter(t => t.length >= 2);
    const validTokens = tokens.filter(t => !NON_GA_WORDS.has(t.toLowerCase()) && !/^\d+$/.test(t) && !/^[\(\)\[\]\/\-–—]+$/.test(t));
    
    // A genuine GA table header must have 3+ distinct non-keyword tokens that start with a capital letter
    // AND at least one recognized geographical city/site or look like proper geographical names
    if (validTokens.length >= 3 && validTokens.every(t => /^[A-Z][a-zA-Z0-9_\-\.]{2,}$/.test(t) && !NON_GA_WORDS.has(t.toLowerCase()))) {
      // Check if at least one token is a known location or line is in a delivery/quantities section
      const hasGeoContext = validTokens.some(t => /pune|nashik|sindhudurg|ramanagara|nanded|nizamabad|mumbai|delhi|surat|chennai|hyderabad|bangalore|kolkata|ahmedabad|nagpur|indore|bhopal|vadodara|ghaziabad|agra|faridabad|meerut|rajkot|varanasi|aurangabad|ranchi|howrah|coimbatore|jabalpur|gwalior|vijayawada|jodhpur|madurai|raipur|kota|guwahati|chandigarh|solapur|hubli|mysore|gurgaon|noida|kochi|dehradun|asansol|rourkela|kolhapur|ajmer|akola|jamnagar|ujjain|jhansi|jammu|sangli|mangalore|erode|belgaum|kurnool|malegaon|gaya|tiruppur|davanagere|kozhikode|gandhinagar|bathinda|hosur|anantapur|bellary|karimnagar|alwar|parbhani|panipat|khammam|korba|kalyan|dombivli|vasai|virar/i.test(t));
      
      if (!hasGeoContext) continue;

      const gaColumns = validTokens;
      console.log(`✓ Found Valid GA Header at line ${i}:`, gaColumns);
      const sectionEnd = Math.min(lines.length - 1, i + 120);

      // Scan rows following this header
      for (let r = i + 1; r <= sectionEnd; r++) {
        const rowLine = lines[r];
        if (/^notes\s*:/i.test(rowLine) || /^terms and conditions/i.test(rowLine)) break;

        // Match item pattern: "1.01", "1.08", "1.10", "1.1", "1", "10", etc.
        const itemMatch = rowLine.match(/^(\d+(?:\.\d+)?)\b/);
        if (!itemMatch) continue;

        const itemNum = itemMatch[1];
        
        // Look for the numbers row (within current line or next 5 lines)
        for (let offset = 0; offset <= 5 && (r + offset) <= sectionEnd; offset++) {
          const targetLine = lines[r + offset];
          
          let numbersLine = targetLine;
          const lastWordMatch = targetLine.match(/(?:UG|Piece\)|Piece\s*\)|\)|mm|inches?|#\d+|\bNOS\b|\bNO\b)\s*([\d\s\-–—]+)$/i);
          if (lastWordMatch) {
            numbersLine = lastWordMatch[1];
          }

          const rawTokens = numbersLine.trim().split(/\s+/).filter(t => /^\d+$/.test(t) || t === '-' || t === '–' || t === '—');
          
          if (rawTokens.length >= gaColumns.length - 1 && rawTokens.length >= 2) {
            while (rawTokens.length < gaColumns.length) {
              rawTokens.push('-');
            }

            const gaValues = rawTokens.slice(0, gaColumns.length);
            const activeGas = [];

            gaValues.forEach((val, idx) => {
              const num = Number(val);
              if (!isNaN(num) && num > 0) {
                activeGas.push(gaColumns[idx]);
              }
            });

            if (activeGas.length > 0) {
              const destStr = formatDestinationList(activeGas);
              itemGaMap.set(itemNum, destStr);
              // Normalize 1.1 -> 1.01, 1.10 -> 1.10, 10 -> 1.10
              if (itemNum === '1.1' || itemNum === '1.10' || itemNum === '10') {
                itemGaMap.set('1.10', destStr);
                itemGaMap.set('1.1', destStr);
                itemGaMap.set('10', destStr);
              } else if (!itemNum.includes('.')) {
                itemGaMap.set(`1.${itemNum.padStart(2, '0')}`, destStr);
              }
              break;
            }
          }
        }
      }
    }
  }

  return itemGaMap;
}

async function testExtraction() {
  const pdfPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\Tender_CSBV_26-27_16.pdf';
  const pdfBuf = fs.readFileSync(pdfPath);
  const parser = new pdfParseModule.PDFParse({ data: pdfBuf });
  await parser.load();
  const res = await parser.getText();
  const text = res.text || '';

  const gaMap = extractGaDistributionFromText(text);
  console.log('\n=== ALL 12 CANONICAL ITEM DESTINATIONS ===');
  for (let i = 1; i <= 12; i++) {
    const itemNo = `1.${String(i).padStart(2, '0')}`;
    const dest = gaMap.get(itemNo);
    console.log(`Item ${itemNo}: "${dest || 'NOT FOUND'}"`);
  }
}

testExtraction().catch(console.error);

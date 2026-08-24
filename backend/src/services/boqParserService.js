const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { getFileBuffer } = require('./localStorageService');

/**
 * Detects product category from a description string.
 * Recognizes both full names and BOQ abbreviations.
 */
function detectProductCategory(desc) {
  const lower = desc.toLowerCase();
  // 1. Services / Supervision
  if (/\b(supervision|erection|installation|commissioning|consulting|manpower)\b/i.test(lower)) return 'Supervision';
  // 2. Structural items (MS ST, structural steel, plates, beams, angles, channels)
  if (/\b(ms\s*st|structural|structure|beam|column|plate|angle|channel|grating|chequered|truss|purlin|pipe\s*rack|staircase|handrail)\b/i.test(lower)) return 'Structural';
  // 3. Full valve names & valve type BOQ abbreviations
  if (lower.includes('valve')) return 'Valves';
  if (/\b(ball|gate|globe|check|butterfly|plug|control|nrv|vlv|chk|btfv|bfv)\b/i.test(lower)) return 'Valves';
  if (/\b(api\s*6d|api\s*600|api\s*602|api\s*608|api\s*594|api\s*598|bs\s*1868|bs\s*1873|bs\s*5352)\b/i.test(lower)) return 'Valves';
  // 4. Shorthand valve BOQ items: e.g. "2 in 150 Manual", "4 in 150 Motoriz", "18 in 600 Motoriz"
  if (/\b\d+(?:\/\d+)?(?:\.\d+)?\s*(?:in|inch|inches|\"|mm|dn)\s+\d+\s*(?:manual|motoriz|gear|lever|handwheel|actuated|flanged|wcb|cf8m|rf|rtj|sw|bw)\b/i.test(lower)) return 'Valves';
  // 5. Tanks & Vessels
  if (lower.includes('tank') || lower.includes('vessel')) return 'Storage Tank';
  if (lower.includes('exchanger') || lower.includes('heater') || lower.includes('cooler')) return 'Heat Exchanger';
  if (lower.includes('piping') || lower.includes('pipe') || lower.includes('flange') || lower.includes('fitting')) return 'Piping';
  return 'Custom';
}

function detectStandardCode(desc) {
  if (!desc) return 'Not specified';
  const lower = desc.toLowerCase();
  const found = [];
  if (lower.includes('asme') || lower.includes('ansi')) found.push('ASME');
  if (lower.includes('api')) found.push('API');
  if (lower.includes('ibr')) found.push('IBR');
  // Match 'is' as a separate word, or followed by colon, dash, space, or number
  if (/\bis\b|\bis[:\-\s\d]/i.test(lower)) found.push('IS');
  if (/\bbs\b|\bbs[:\-\s\d]/i.test(lower)) found.push('BS');
  if (/\ben\b|\ben[:\-\s\d]/i.test(lower)) found.push('EN');

  // Pipe schedule specifications (Sch 7, Sch 8, Schedule 40, Sch STD, Sch XS, Sch XXS)
  const schMatches = lower.match(/\bsch(?:edule)?[\s\-]*(\d+|std|xs|xxs)\b/gi);
  if (schMatches) {
    for (const m of schMatches) {
      // Normalize to "Sch X" format with uppercase suffix
      const suffixMatch = m.match(/(\d+|std|xs|xxs)$/i);
      if (suffixMatch) {
        const suffix = suffixMatch[1];
        // Numbers stay as-is, text suffixes get uppercased
        const normalizedSuffix = /^\d+$/.test(suffix) ? suffix : suffix.toUpperCase();
        const normalized = `Sch ${normalizedSuffix}`;
        if (!found.includes(normalized)) {
          found.push(normalized);
        }
      }
    }
  }
  
  if (found.length > 0) {
    return found.join(', ');
  }
  return 'Not specified';
}

function normalizeUnit(unitStr) {
  if (!unitStr) return 'NOS';
  const u = String(unitStr).trim().toLowerCase();
  if (['nos', 'numbers', 'no', 'number', 'each', 'ea', 'pc', 'pcs', 'pieces', 'uom', 'number(s)', 'numbers(s)'].includes(u)) {
    return 'NOS';
  }
  if (['set', 'sets'].includes(u)) {
    return 'SET';
  }
  if (['mt', 'metric tons', 'metric ton', 'ton', 'tons'].includes(u)) {
    return 'MT';
  }
  if (['kg', 'kilograms', 'kilogram', 'kgs'].includes(u)) {
    return 'KG';
  }
  if (['m', 'meter', 'meters', 'mtrs', 'mtr'].includes(u)) {
    return 'M';
  }
  if (['m2', 'sqm', 'square meters', 'square meter', 'sq.m', 'sq m'].includes(u)) {
    return 'M2';
  }
  // Mandays must remain as 'Mandays' — never collapse into 'Job'.
  // These are engineering supervision units and must be preserved exactly.
  if (['mandays', 'manday', 'man-days', 'man-day', 'man days', 'man day', 'mondays', 'monday', 'mon-days', 'mon-day', 'mon days', 'mon day'].includes(u)) {
    return 'Mandays';
  }
  if (['ls', 'lump sum', 'lumpsum', 'l/s'].includes(u)) {
    return 'LS';
  }
  if (['lot', 'lots'].includes(u)) {
    return 'LOT';
  }
  if (['job', 'jobs'].includes(u)) {
    return 'Job';
  }
  // Preserve original unit string for unrecognized units instead of
  // blindly defaulting to 'NOS' (which loses information).
  return String(unitStr).trim().toUpperCase() || 'NOS';
}

/**
 * Parses products structurally from an Excel sheet.
 */
function isPlaceholderValue(val) {
  if (!val) return true;
  const l = String(val).toLowerCase().trim();
  return (
    l === 'as per sor' ||
    l === 'refer sor' ||
    l === 'as per spec' ||
    l === 'as per specs' ||
    l === 'as per datasheet' ||
    l === 'refer datasheet' ||
    l === 'attached' ||
    l === 'refer annexure' ||
    l === 'as per annexure' ||
    l === '-' ||
    l === 'na' ||
    l === 'n/a'
  );
}

/**
 * Helper to dynamically format an array of non-zero destination/GA names
 * e.g. ['Pune'] -> 'Pune GA'
 * e.g. ['Nashik', 'Nizamabad'] -> 'Nashik & Nizamabad GAs'
 * e.g. ['Pune', 'Ramanagara', 'Nanded', 'Nizamabad'] -> 'Pune, Ramanagara, Nanded & Nizamabad GAs'
 */
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

/**
 * Robust, dynamic parser for Schedule of Rates (SOR) & Geographical Area breakdown tables.
 * Dynamically detects GA headers (e.g. Pune, Nashik, Sindhudurg, Ramanagara, Nanded, Nizamabad, etc.)
 * and accurately aligns them with row quantity distributions, filtering out zero/empty values.
 */
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
    if (validTokens.length >= 3 && validTokens.every(t => /^[A-Z][a-zA-Z0-9_\-\.]{2,}$/.test(t) && !NON_GA_WORDS.has(t.toLowerCase()))) {
      // Check if at least one token is a known location or line is in a delivery/quantities section
      const hasGeoContext = validTokens.some(t => /pune|nashik|sindhudurg|ramanagara|nanded|nizamabad|mumbai|delhi|surat|chennai|hyderabad|bangalore|kolkata|ahmedabad|nagpur|indore|bhopal|vadodara|ghaziabad|agra|faridabad|meerut|rajkot|varanasi|aurangabad|ranchi|howrah|coimbatore|jabalpur|gwalior|vijayawada|jodhpur|madurai|raipur|kota|guwahati|chandigarh|solapur|hubli|mysore|gurgaon|noida|kochi|dehradun|asansol|rourkela|kolhapur|ajmer|akola|jamnagar|ujjain|jhansi|jammu|sangli|mangalore|erode|belgaum|kurnool|malegaon|gaya|tiruppur|davanagere|kozhikode|gandhinagar|bathinda|hosur|anantapur|bellary|karimnagar|alwar|parbhani|panipat|khammam|korba|kalyan|dombivli|vasai|virar/i.test(t));
      
      if (!hasGeoContext) continue;

      const gaColumns = validTokens;
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

/**
 * Parses products structurally from an Excel sheet with intelligent header row detection,
 * multi-column filtering, and garbage row suppression.
 */
function extractCleanBoqItems(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const allProducts = [];

  for (const sheetName of workbook.SheetNames) {
    if (/macro|instruction|summary|help|guideline/i.test(sheetName)) continue;
    const sheet = workbook.Sheets[sheetName];
    const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!rawMatrix || rawMatrix.length === 0) continue;

    let headerRowIdx = -1;
    let colMap = { itemNo: -1, desc: -1, itemCode: -1, qty: -1, unit: -1, destination: -1, destCols: [] };

    for (let r = 0; r < Math.min(rawMatrix.length, 35); r++) {
      const row = rawMatrix[r].map(c => String(c).trim().toLowerCase());
      const hasDesc = row.some(c => c.includes('description') || c.includes('item desc') || c.includes('particulars'));
      const hasQty = row.some(c => c === 'quantity' || c === 'qty' || c.includes('quantity') || c.includes('qty'));
      
      if (hasDesc && (hasQty || row.some(c => c.includes('unit') || c.includes('sl') || c.includes('item')))) {
        headerRowIdx = r;
        rawMatrix[r].forEach((colVal, colIdx) => {
          const c = String(colVal).trim().toLowerCase();
          const orig = String(colVal).trim();
          if (colMap.itemNo === -1 && (c.includes('sl') || c.includes('item no') || c.includes('item wise') || c === 'item' || c.includes('sr'))) colMap.itemNo = colIdx;
          if (colMap.desc === -1 && (c.includes('description') || c.includes('particular') || c.includes('item desc'))) colMap.desc = colIdx;
          if (colMap.itemCode === -1 && (c.includes('code') || c.includes('make') || c.includes('item code'))) colMap.itemCode = colIdx;
          if (colMap.qty === -1 && (c === 'quantity' || c === 'qty' || c.includes('quantity') || c.includes('qty'))) colMap.qty = colIdx;
          if (colMap.unit === -1 && (c.includes('unit') || c.includes('uom') || c === 'units')) colMap.unit = colIdx;
          if (colMap.destination === -1 && (c.includes('destination') || c.includes('delivery site') || c.includes('location'))) colMap.destination = colIdx;
          
          // Check for individual location / GA columns in multi-site BOQs
          if (orig.length >= 3 && /^[A-Z][a-zA-Z0-9_\-\.]{2,}$/.test(orig) && 
              !/^(quoted|not|\/|sl|sr|no|\(no\.?\)|total|quantity|quantities|item|description|schedule|rates|unit|units|price|rate|amount|gst|vat|tax|taxes)$/i.test(orig)) {
            colMap.destCols.push({ name: orig, colIdx });
          }
        });
        break;
      }
    }

    if (headerRowIdx === -1) {
      // Fallback for simple flat Excel files without multi-line header blocks
      const rows = XLSX.utils.sheet_to_json(sheet);
      if (rows.length > 0) {
        for (const row of rows) {
          const descKey = Object.keys(row).find(k => /desc|particular|specification|valve|item/i.test(k));
          const qtyKey = Object.keys(row).find(k => /qty|quantity/i.test(k));
          const unitKey = Object.keys(row).find(k => /unit|uom/i.test(k));
          if (descKey && row[descKey]) {
            const desc = String(row[descKey]).trim();
            if (desc.length > 3 && !/total|summary/i.test(desc)) {
              allProducts.push({
                itemNo: `${allProducts.length + 1}`,
                productDescription: desc,
                description: desc,
                quantity: parseFloat(row[qtyKey]) || 1,
                unit: normalizeUnit(row[unitKey] || 'NOS'),
                productCategory: detectProductCategory(desc),
                category: detectProductCategory(desc),
                standardCode: detectStandardCode(desc),
                dynamicFields: {}
              });
            }
          }
        }
      }
      continue;
    }

    for (let r = headerRowIdx + 1; r < rawMatrix.length; r++) {
      const row = rawMatrix[r];
      if (!row || row.length === 0) continue;

      const itemNoRaw = colMap.itemNo !== -1 ? String(row[colMap.itemNo] || '').trim() : '';
      const descRaw = colMap.desc !== -1 ? String(row[colMap.desc] || '').trim() : '';
      const qtyRaw = colMap.qty !== -1 ? row[colMap.qty] : '';
      const unitRaw = colMap.unit !== -1 ? String(row[colMap.unit] || '').trim() : 'NOS';
      let destRaw = colMap.destination !== -1 ? String(row[colMap.destination] || '').trim() : '';

      // If multi-column destinations are detected in the Excel sheet
      if (colMap.destCols && colMap.destCols.length >= 2) {
        const activeDestNames = [];
        colMap.destCols.forEach(dc => {
          const val = Number(row[dc.colIdx]);
          if (!isNaN(val) && val > 0) {
            activeDestNames.push(dc.name);
          }
        });
        if (activeDestNames.length > 0) {
          destRaw = formatDestinationList(activeDestNames);
        }
      }

      if (!descRaw || descRaw.length < 3) continue;

      // Skip summary / quotation rows
      if (/total in figures|quoted rate|total amount|grand total|words/i.test(descRaw) ||
          /total in figures|quoted rate|total amount|grand total|words/i.test(itemNoRaw)) continue;

      // Skip sequential column numbering rows (e.g. 1, 2, 3...)
      if (/^\d+$/.test(itemNoRaw) && Number(itemNoRaw) === 1 && String(row[colMap.desc]).trim() === '2') continue;

      // Skip generic instruction/preamble rows
      if (/^supply of .* as per technical specifications/i.test(descRaw) && (!qtyRaw || isNaN(Number(qtyRaw)))) continue;

      // Filter out garbage / non-valve / chamber civil works rows
      if (/construction of chamber/i.test(descRaw)) continue;

      let quantity = Number(qtyRaw);
      if (isNaN(quantity) || quantity <= 0) continue;

      let cleanItemNo = itemNoRaw;
      if (!cleanItemNo && /^\d+(\.\d+)?/.test(descRaw)) {
        const m = descRaw.match(/^(\d+(\.\d+)?)/);
        cleanItemNo = m ? m[1] : '';
      }
      // If item number is e.g. "1.1" and previous items were 1.01..1.09, normalize 1.1 to 1.10
      if (cleanItemNo === '1.1' && allProducts.length >= 9) {
        cleanItemNo = '1.10';
      }

      allProducts.push({
        itemNo: cleanItemNo || `${allProducts.length + 1}`,
        productDescription: descRaw,
        description: descRaw,
        quantity,
        unit: normalizeUnit(unitRaw),
        destination: destRaw,
        productCategory: detectProductCategory(descRaw),
        category: detectProductCategory(descRaw),
        standardCode: detectStandardCode(descRaw),
        dynamicFields: {}
      });
    }
  }

  return allProducts;
}

function parseExcelBOQ(buffer) {
  return extractCleanBoqItems(buffer);
}

/**
 * Parses products structurally from PDF text lines using regex matching.
 */
function parsePdfTableBOQ(text) {
  if (!text) return [];
  const lines = text.split('\n');
  const products = [];

  // Patterns matching table lines:
  // e.g. "1. CS Ball Valve 100mm Qty: 15 Nos"
  // e.g. "10  SS Gate Valve 50mm  NOS  8"
  const pattern1 = /^\s*(\d+)[\s\.\,\)]+([A-Za-z0-9\s#\-\"\.\,\/\'\%\&]{10,200}?)\s+(\d+)\s+(nos|set|sets|pcs|pcs\.|mt|kg|mtrs?|m|uom|ea|each)\b/i;
  const pattern2 = /^\s*(\d+)[\s\.\,\)]+([A-Za-z0-9\s#\-\"\.\,\/\'\%\&]{10,200}?)\s+(nos|set|sets|pcs|pcs\.|mt|kg|mtrs?|m|uom|ea|each)\s+(\d+)\b/i;

  for (const line of lines) {
    const cleanLine = line.trim();
    let match = cleanLine.match(pattern1);
    if (match) {
      products.push({
        productDescription: match[2].trim(),
        quantity: parseFloat(match[3]) || 1,
        unit: normalizeUnit(match[4]),
        productCategory: detectProductCategory(match[2]),
        standardCode: detectStandardCode(match[2])
      });
      continue;
    }
    match = cleanLine.match(pattern2);
    if (match) {
      products.push({
        productDescription: match[2].trim(),
        quantity: parseFloat(match[4]) || 1,
        unit: normalizeUnit(match[3]),
        productCategory: detectProductCategory(match[2]),
        standardCode: detectStandardCode(match[2])
      });
    }
  }

  // Return any structured matches found (even 1 valid row is a real product)
  if (products.length >= 1) {
    return products;
  }
  return [];
}

/**
 * Main entry point: Parses structured BOQs from attachments.
 */
async function parseStructuredBOQ(attachment) {
  console.log(`[Structured BOQ Parser] Attempting to parse: ${attachment.originalFileName}`);
  try {
    const buffer = await getFileBuffer(attachment.storagePath);
    const fileName = attachment.originalFileName.toLowerCase();

    // Excel route
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv') || attachment.fileType.includes('spreadsheet') || attachment.fileType.includes('excel')) {
      const products = parseExcelBOQ(buffer);
      console.log(`[Structured BOQ Parser] Successfully parsed Excel BOQ. Found ${products.length} products.`);
      return products;
    }

    // PDF route
    if (fileName.endsWith('.pdf') || attachment.fileType.includes('pdf')) {
      try {
        const pyClient = require('./pythonExtractorClient');
        const pyResult = await pyClient.extractFile(buffer, attachment.originalFileName);
        if (pyResult.success && pyResult.items && pyResult.items.length > 0) {
          console.log(`[Structured BOQ Parser] Successfully parsed PDF via Python Extractor. Found ${pyResult.items.length} products.`);
          return pyResult.items.map(item => ({
            productDescription: item.description,
            quantity: item.quantity || 1,
            unit: item.unit || 'NOS',
            productCategory: 'Valves',
            standardCode: item.valve_design_std || 'Not specified',
            confidence: Math.round((item.confidence || 0.95) * 100),
            dynamicFields: {
              valve_type: item.valve_type,
              valve_size: item.valve_size,
              valve_class: item.valve_class,
              valve_moc_body: item.valve_moc_body,
              valve_end_connection: item.valve_end_connection,
              valve_operating: item.valve_operating
            }
          }));
        }
      } catch (pyErr) {
        console.warn(`[Structured BOQ Parser] Python extractor fallback: ${pyErr.message}`);
      }

      const products = parsePdfTableBOQ(attachment.extractedText || '');
      if (products.length > 0) {
        console.log(`[Structured BOQ Parser] Successfully parsed PDF BOQ via regex tables. Found ${products.length} products.`);
        return products;
      }
    }

    console.log(`[Structured BOQ Parser] No structured match for ${attachment.originalFileName}. Falling back to AI.`);
    return [];
  } catch (err) {
    console.error(`[Structured BOQ Parser] Error parsing ${attachment.originalFileName}:`, err.message);
    return [];
  }
}/**
 * Strips non-valve/non-enquiry sections from email body text.
 * Removes non-valve auxiliary tables (lube oil, petroleum, legal terms, signatures).
 * Never strips sections that contain genuine valve line items.
 */
function stripNonValveSections(text) {
  if (!text) return '';

  const boundaries = [
    /^\s*product\s+details\s*[:=-]+\s*(?:finished\s+product|lube\s+oil|petroleum|fuel)/im,
    /^\s*(?:finished\s+product\s+of\s+lube\s+oil|lube\s+oil\s+details)/im,
    /^\s*terms\s+(?:&|and)\s+conditions/im,
    /^\s*commercial\s+terms\s*:/im,
    /^\s*payment\s+terms\s*:/im,
    /^\s*delivery\s+terms\s*:/im,
    /^\s*\*?regards\*?\s*,?\s*$/im,
    /^\s*\*?thank(?:s|ing)?\s+(?:you|and)[\s,*]*/im,
    /^\s*\*?best\s+regards\*?/im,
    /^\s*\*?warm\s+regards\*?/im
  ];

  let endIndex = text.length;
  for (const boundary of boundaries) {
    const match = text.match(boundary);
    if (match && match.index < endIndex) {
      // Ensure we don't prematurely strip if the remaining text contains actual valve line items
      const afterText = text.substring(match.index);
      if (/\b(?:ball|gate|globe|check|butterfly|plug)\s+valve\b/i.test(afterText) && !/lube\s+oil|terms\s+(?:&|and)\s+conditions|thank(?:s|ing)?\s+you|regards/i.test(match[0])) {
        continue;
      }
      endIndex = match.index;
    }
  }

  return text.substring(0, endIndex).trim();
}

/**
 * Returns true if a row is a non-product header/intro/footer sentence.
 * Used to filter out descriptions like "Supply and delivery of Ball Valves..."
 */
function isNonProductRow(text) {
  if (!text || typeof text !== 'string') return true;
  const lower = text.toLowerCase().trim();

  // Reject rows containing pure intro/header/footer phrases
  const rejectPatterns = [
    /\bsupply\s+and\s+delivery\b/,
    /\brequirement\s+of\b/,
    /\bvendor\s+shall\b/,
    /\bcertificate\b/,
    /\bplease\s+quote\b/,
    /\bplease\s+provide\b/,
    /\bkindly\s+(?:share|provide|quote|send)\b/,
    /\bregards\b/,
    /\bterms\s+(?:and|&)\s+conditions\b/,
    /\bspecification\s+(?:for|of)\b/,
    /\bproject\s+description\b/,
    /\bdear\s+(?:sir|madam|team)\b/,
    /\bwe\s+(?:have|are|need|require)\b/,
    /\bfinished\s+product\b/,
    /\bthank(?:s|ing)?\s+(?:you|and)\b/,
    /\bbest\s+regards\b/,
    /\bwarm\s+regards\b/,
    /\bnote\s*:/,
    /\bscope\s+of\s+(?:work|supply)\b/,
    /\battached\s+(?:herewith|please)\b/,
    /\bsubject\s*:/
  ];

  for (const pattern of rejectPatterns) {
    if (pattern.test(lower)) return true;
  }

  // CRITICAL: If the row actually contains product tokens AND size/class/valve/qty indicators,
  // it is a real product row and MUST NOT be rejected!
  if (isProductIndicatorRow(text) && (
    /\b\d+\s*(?:"|inch|in|mm|#|nos|ea|pcs|nb|class|cl|lbs)\b/i.test(lower) ||
    /\b(?:ball|gate|globe|check|butterfly|plug|valve|vlv)\b/i.test(lower)
  )) {
    return false;
  }

  // Reject very long prose sentences (> 120 chars with no size/class indicators)
  if (lower.length > 120 && !/\b\d+\s*(?:"|inch|in|mm|#|nos|ea|pcs)\b/i.test(lower)) {
    return true;
  }

  return false;
}

/**
 * Returns true if a text row contains product indicator tokens
 * (engineering abbreviations that identify it as a real product line).
 */
function isProductIndicatorRow(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();

  const productTokens = [
    /\b(ball|gate|globe|check|butterfly|plug|control|needle|safety)\b/i,
    /\bvalve\b/i,
    /\b(vlv|chk|btfv|bfv|nrv|prv|srv|ibv|mov|aov|sdv)\b/i,
    /\b(api\s*\d+|ansi\s*\d+|asme)\b/i,
    /\b(flg|flange[d]?|rf|rtj)\b/i,
    /\b(wcb|lcb|wcc|cf8m?|a105|a216|a351|a352|ss\s*\d+|cs|lf2)\b/i,
    /\b(hov|mov|aov)\b/i,
    /\b(tru|bol|trunnion|bolted)\b/i,
    /\b(f\/f|w\/w|a\/g|b\/w|s\/w)\b/i
  ];

  let matchCount = 0;
  for (const pattern of productTokens) {
    if (pattern.test(lower)) matchCount++;
  }

  // At least 1 strong indicator required
  return matchCount >= 1;
}

/**
 * Deterministic email body line item parser.
 * Splits numbered/bulleted line items from email body text into separate products.
 *
 * Handles real-world formats:
 *   Strategy 1: Single-line (numbered or bulleted with quantity indicator)
 *   Strategy 2: Multi-line (serial on one line, desc on next, qty after)
 *   Strategy 3: BOQ table rows without serial numbers
 *   Strategy 4: Tab/pipe-delimited OCR table rows
 *   Strategy 5: Direct single-item valve RFQ (Deterministic Extraction)
 *
 * Returns [] if no items found (falls through to AI).
 */
function parseEmailBodyLineItems(bodyText) {
  if (!bodyText || typeof bodyText !== 'string') return [];

  // Step 1: Strip non-valve sections (lube oil, terms, signatures)
  const cleanedText = stripNonValveSections(bodyText);
  if (!cleanedText || cleanedText.trim().length < 10) return [];

  // ── Strategy 0: Multi-Line Specification Blocks ────────────────────────
  // Handles formatted engineering RFQs where each item has multi-line bulleted specs:
  //   Item 01: API 6D Floating Ball Valve
  //   - Size: 2" (50 MM)
  //   - Pressure Class: 150#
  //   - Body MOC: ASTM A216 Gr. WCB
  //   - Quantity: 5 Nos.
  const blockHeaderRegex = /(?:^|\n)\s*(?:item|sr\.?\s*no\.?|sl\.?\s*no\.?|line)\s*[\d]{1,3}\s*[:.)-]\s*(.+?)(?=(?:\n\s*(?:item|sr\.?\s*no\.?|sl\.?\s*no\.?|line)\s*[\d]{1,3}\s*[:.)-]|\n\s*[-–=]{8,}|\n\s*(?:commercial|terms|general\s+terms|notes?|thank|regards))|$)/gis;

  let blockMatch;
  const blockProducts = [];
  while ((blockMatch = blockHeaderRegex.exec(cleanedText)) !== null) {
    const fullBlockText = blockMatch[0].trim();

    // Extract quantity from within the block (e.g. Quantity: 5 Nos, Qty: 2, 5 Nos.)
    let blockQty = 1;
    const qtyMatch = fullBlockText.match(/(?:qty|quantity|numbers?|pcs|sets?|ea|each)\s*[:=–-]?\s*(\d+)/i) ||
                     fullBlockText.match(/\b(\d+)\s*(?:nos|pcs|sets?|ea|each)\b/i);
    if (qtyMatch) {
      blockQty = parseInt(qtyMatch[1], 10) || 1;
    }

    // Clean up block lines into a single coherent description string
    const cleanLines = fullBlockText
      .split('\n')
      .map(l => l.replace(/^[\s\-*•]+/, '').trim())
      .filter(l => l.length > 0 && !isNonProductRow(l));

    const combinedDesc = cleanLines.join(' | ').trim();
    if (combinedDesc.length >= 5 && isProductIndicatorRow(combinedDesc)) {
      blockProducts.push({
        productDescription: combinedDesc,
        quantity: blockQty,
        unit: normalizeUnit('NOS'),
        productCategory: detectProductCategory(combinedDesc),
        standardCode: detectStandardCode(combinedDesc)
      });
    }
  }

  if (blockProducts.length > 0) {
    console.log(`[Email Body Parser] Multi-line Specification Block Strategy (Strategy 0) found ${blockProducts.length} line items.`);
    return blockProducts;
  }

  const lines = cleanedText.split('\n').map(l => l.trim()).filter(Boolean);
  const products = [];

  // ── Strategy 1: Single-line format (Numbered, Bulleted, or Prefixed) ──────
  // Pattern: Optional Sr.No/Bullet + Description + Qty Indicator (e.g. Nos. 16, 16 Nos, Qty: 16, (Qty: 16))
  const patternA = /^\s*(?:(?:item|sr|sl|line)?\s*[\d]{1,3}\s*[:.)-]?|[-*•])\s*(.+?)\s+(?:nos|qty|quantity|numbers?|pcs|sets?|ea|each)[.:\s=-]*(\d+)\s*$/i;
  const patternB = /^\s*(?:(?:item|sr|sl|line)?\s*[\d]{1,3}\s*[:.)-]?|[-*•])\s*(.+?)\s+[-–:,]?\s*(\d+)\s*(?:nos|qty|quantity|numbers?|pcs|sets?|ea|each)[.:]?\s*$/i;
  const patternC = /^\s*(?:(?:item|sr|sl|line)?\s*[\d]{1,3}\s*[:.)-]?|[-*•])\s*(.+?)\s+[-–:,]?\s*\(?\s*(?:qty|quantity)\s*[:=–-]?\s*(\d+)\s*(?:nos|pcs|ea|sets?)?\s*\)?\s*$/i;
  const patternD = /^\s*(?:(?:item|sr|sl|line)?\s*[\d]{1,3}\s*[:.)-]?|[-*•])\s*(.+?)\s+[-–:,]?\s*\(\s*(\d+)\s*(?:nos|pcs|ea|sets?|qty|quantity)[.:]?\s*\)\s*$/i;

  for (const line of lines) {
    // Skip header-like lines
    if (/^\s*(?:sr\.?\s*no|sl\.?\s*no|s\.?\s*no|item|#|description|particular|detail)/i.test(line)) continue;
    if (/^\s*(?:unit|qty|quantity|nos|uom)\s*$/i.test(line)) continue;

    let match = line.match(patternA) || line.match(patternB) || line.match(patternC) || line.match(patternD);
    if (match) {
      const desc = match[1].trim();
      const qty = parseInt(match[2], 10) || 1;

      // Guard: description must not be just a quantity/unit label
      if (/^(?:qty|quantity|unit|sr|sl|item|no)\s*[:.]?$/i.test(desc.trim())) {
        continue;
      }

      // Validate: description must be at least 5 chars and contain letters
      if (desc.length >= 5 && /[a-zA-Z]/.test(desc) && !isNonProductRow(desc)) {
        products.push({
          productDescription: desc,
          quantity: qty,
          unit: normalizeUnit('NOS'),
          productCategory: detectProductCategory(desc),
          standardCode: detectStandardCode(desc)
        });
      }
    }
  }

  if (products.length > 0) {
    console.log(`[Email Body Parser] Single-line strategy found ${products.length} line items.`);
    return products;
  }

  // ── Strategy 2: Multi-line format ──────────────────────────────────────
  // Some emails break items across lines:
  //   1
  //   4" Shut off valve - pneumatic type
  //   Nos.
  //   16
  //
  // Detect sequences: [serial_number_line] [description_line(s)] [unit_line] [qty_line]

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Check if this line is a standalone serial number (1-3 digits)
    if (/^\d{1,3}$/.test(line)) {
      const serialNum = parseInt(line, 10);
      let descParts = [];
      let qty = 1;
      let unit = 'NOS';
      let foundQty = false;
      let j = i + 1;

      while (j < lines.length) {
        const nextLine = lines[j].trim();

        // 1. Check if next line is the sequential serial number of the NEXT row (e.g. 2 -> 3 -> 4)
        if (/^\d{1,2}$/.test(nextLine)) {
          const nextSerial = parseInt(nextLine, 10);
          if (descParts.length > 0 && nextSerial === serialNum + 1) {
            break;
          }
        }

        // 2. Check if this line is a unit indicator BEFORE quantity (e.g. "Nos." \n "16")
        if (/^(?:nos|qty|quantity|numbers?|pcs|sets?|ea|each|lot|mtr|meters?)[.:]?$/i.test(nextLine)) {
          unit = nextLine;
          if (j + 1 < lines.length && /^\d+(?:\.\d+)?$/.test(lines[j + 1].trim())) {
            qty = parseFloat(lines[j + 1].trim()) || 1;
            foundQty = true;
            j += 2;
          } else {
            j++;
          }
          break;
        }

        // 3. Check if this line is a quantity number (e.g. "35.00", "2500", "1.00")
        if (/^\d+(?:\.\d+)?$/.test(nextLine) && descParts.length > 0) {
          qty = parseFloat(nextLine) || 1;
          foundQty = true;
          j++;
          // Check if subsequent line is a unit (e.g. "EA", "NOS")
          if (j < lines.length && /^(?:nos|qty|quantity|numbers?|pcs|sets?|ea|each|lot|mtr|meters?)[.:]?$/i.test(lines[j].trim())) {
            unit = lines[j].trim();
            j++;
          }
          break;
        }

        // Check if we hit a section boundary
        if (/^(?:product\s+details|terms|regards|thank|vendor\s+shall)/i.test(nextLine)) {
          break;
        }

        // Otherwise it's part of the description
        if (nextLine.length > 0 && /[a-zA-Z]/.test(nextLine)) {
          if (!/^(?:sl\.?\s*no|item\s*description|quantity|units?)[.:*]*$/i.test(nextLine)) {
            descParts.push(nextLine);
          }
        }
        j++;
      }

      if (descParts.length > 0) {
        const fullDesc = descParts.join(' ').trim();
        if (fullDesc.length >= 5 && !isNonProductRow(fullDesc)) {
          products.push({
            productDescription: fullDesc,
            quantity: Math.round(qty),
            unit: normalizeUnit(unit),
            productCategory: detectProductCategory(fullDesc),
            standardCode: detectStandardCode(fullDesc)
          });
        }
      }

      i = j;
      continue;
    }

    i++;
  }

  if (products.length > 0) {
    console.log(`[Email Body Parser] Multi-line strategy found ${products.length} line items.`);
    return products;
  }

  // ── Strategy 3: BOQ table rows WITHOUT serial numbers ──────────────────
  // Handles formats like:
  //   BALL API6D HOV F/F A/G TRU BOL 2IN 300#    35    EA
  //   VLV,CHK,A216 WCB,A216 WCB,FLG,300,10IN      1    EA
  //   1" x 800# W/W A/G HOV API 602 GATE VALVE    2    EA
  //   18" x ANSI 150# HOV F/F API 600 Gate Valve   1    EA
  //
  // Pattern: <description with product indicators> <quantity number> <unit>
  // OR:      <description with product indicators> <unit> <quantity number>

  const boqPatternA = /^(.+?)\s+(\d+)\s+(nos|ea|each|pcs|sets?|mt|kg|lot)\s*$/i;
  const boqPatternB = /^(.+?)\s+(nos|ea|each|pcs|sets?|mt|kg|lot)\s+(\d+)\s*$/i;
  // Also handle rows ending with just a number (no explicit unit)
  const boqPatternC = /^(.+?)\s{2,}(\d+)\s*$/;

  for (const line of lines) {
    // Skip header-like lines
    if (/^\s*(?:sr\.?\s*no|sl\.?\s*no|s\.?\s*no|item\s*(?:no|#|desc)|#|description|particular|detail)/i.test(line)) continue;
    if (/^\s*(?:unit|qty|quantity|nos|uom)\s*$/i.test(line)) continue;

    let desc = null;
    let qty = 1;
    let unit = 'NOS';

    let match = line.match(boqPatternA);
    if (match) {
      desc = match[1].trim();
      qty = parseInt(match[2], 10) || 1;
      unit = match[3];
    }

    if (!desc) {
      match = line.match(boqPatternB);
      if (match) {
        desc = match[1].trim();
        qty = parseInt(match[3], 10) || 1;
        unit = match[2];
      }
    }

    if (!desc) {
      match = line.match(boqPatternC);
      if (match) {
        desc = match[1].trim();
        qty = parseInt(match[2], 10) || 1;
        unit = 'NOS';
      }
    }

    if (desc && desc.length >= 5 && /[a-zA-Z]/.test(desc) && !isNonProductRow(desc) && isProductIndicatorRow(desc)) {
      products.push({
        productDescription: desc,
        quantity: qty,
        unit: normalizeUnit(unit),
        productCategory: detectProductCategory(desc),
        standardCode: detectStandardCode(desc)
      });
    }
  }

  if (products.length > 0) {
    console.log(`[Email Body Parser] BOQ table strategy (Strategy 3) found ${products.length} line items.`);
    return products;
  }

  // ── Strategy 4: Tab/pipe-delimited OCR table rows ──────────────────────
  // Handles OCR output from PDF tables with pipe or tab delimiters:
  //   1 | BALL API6D HOV 2IN 300# | 35 | EA
  //   2 | VLV,CHK,A216 WCB | 1 | EA

  const delimiterPattern = /[|\t]/;
  const tabulatedLines = lines.filter(l => delimiterPattern.test(l));

  if (tabulatedLines.length >= 2) {
    for (const line of tabulatedLines) {
      const cells = line.split(delimiterPattern).map(c => c.trim()).filter(Boolean);
      if (cells.length < 2) continue;

      // Find the description cell (longest cell with letters)
      let descCell = '';
      let qtyCell = '';
      let unitCell = '';

      for (const cell of cells) {
        if (/^\d{1,5}$/.test(cell)) {
          // Pure number — could be serial, qty, or skip
          if (!qtyCell && descCell) {
            qtyCell = cell; // qty comes after desc
          }
          continue;
        }
        if (/^(?:nos|ea|each|pcs|sets?|mt|kg|lot|uom)$/i.test(cell)) {
          unitCell = cell;
          continue;
        }
        // Must be description (has letters and is > 5 chars)
        if (/[a-zA-Z]/.test(cell) && cell.length > 5) {
          descCell = cell;
        }
      }

      if (descCell && !isNonProductRow(descCell) && isProductIndicatorRow(descCell)) {
        products.push({
          productDescription: descCell,
          quantity: parseInt(qtyCell, 10) || 1,
          unit: normalizeUnit(unitCell || 'NOS'),
          productCategory: detectProductCategory(descCell),
          standardCode: detectStandardCode(descCell)
        });
      }
    }
  }

  if (products.length > 0) {
    console.log(`[Email Body Parser] Tabulated OCR strategy (Strategy 4) found ${products.length} line items.`);
    return products;
  }

  // ── Strategy 5: Direct Single-Item Valve RFQ (Deterministic Extraction) ─
  // Handles unstructured single-paragraph RFQs like:
  // "Please quote 2 Nos Ball Valves, 50 mm, Class 150#, Body MOC ASTM A216 WCB. End connection: Flanged RF. PMI test required."
  try {
    const extractorRegistry = require('./extraction/ExtractorRegistry');
    const tokenizer = require('./extraction/Tokenizer');
    const tokText = tokenizer.tokenize(cleanedText);
    const regexExtractions = extractorRegistry.runAll(tokText);

    const valveTypeField = regexExtractions['ValveExtractor'];
    const qtyField = regexExtractions['QuantityExtractor'];
    const sizeField = regexExtractions['SizeExtractor'];
    const classField = regexExtractions['ClassExtractor'];

    if (valveTypeField && valveTypeField.normalizedValue && (sizeField?.normalizedValue || classField?.normalizedValue || qtyField?.normalizedValue)) {
      const qtyVal = qtyField && qtyField.normalizedValue ? Number(qtyField.normalizedValue) : null;
      const unitVal = qtyField && qtyField.unit ? normalizeUnit(qtyField.unit) : 'NOS';

      products.push({
        productDescription: cleanedText.split('\n')[0].trim().substring(0, 300) || cleanedText.trim().substring(0, 300),
        quantity: qtyVal,
        unit: unitVal,
        productCategory: 'Valves',
        standardCode: detectStandardCode(cleanedText),
        confidence: 100
      });

      console.log(`[Email Body Parser] Direct single-item valve RFQ strategy (Strategy 5) found 1 deterministic product.`);
      return products;
    }
  } catch (strat5Err) {
    console.warn('[Email Body Parser] Strategy 5 error:', strat5Err.message);
  }

  return products;
}

module.exports = {
  parseExcelBOQ,
  parsePdfTableBOQ,
  parseStructuredBOQ,
  mergeEnquiryProducts,
  normalizeUnit,
  parseEmailBodyLineItems,
  stripNonValveSections,
  isNonProductRow,
  isProductIndicatorRow
};

/**
 * Pass-through function: Preserves 100% of BOQ line items as independent rows.
 * Deduplication and merging are strictly disabled per ERP procurement requirements.
 */
function mergeEnquiryProducts(products) {
  if (!Array.isArray(products)) return [];
  console.log(`[BOQ Line Items] Preserving ${products.length} line items without merging.`);
  return products.map(p => ({ ...p }));
}

/**
 * Generates a category summary count object (e.g. { "Ball Valve": 6, "Check Valve": 1, "Gate Valve": 3 })
 * without altering or reducing the line_items array.
 */
function generateProductSummary(products) {
  if (!Array.isArray(products)) return {};
  const summary = {};
  for (const prod of products) {
    const cat = prod.productCategory || prod.category || 'Custom';
    summary[cat] = (summary[cat] || 0) + 1;
  }
  return summary;
}

module.exports = {
  parseExcelBOQ,
  parsePdfTableBOQ,
  parseStructuredBOQ,
  mergeEnquiryProducts,
  generateProductSummary,
  normalizeUnit,
  parseEmailBodyLineItems,
  stripNonValveSections,
  isNonProductRow,
  isProductIndicatorRow,
  detectStandardCode,
  detectProductCategory,
  extractGaDistributionFromText,
  formatDestinationList
};

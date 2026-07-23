const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { getFileBuffer } = require('./localStorageService');

/**
 * Detects product category from a description string.
 */
function detectProductCategory(desc) {
  const lower = desc.toLowerCase();
  if (lower.includes('valve')) return 'Valves';
  if (lower.includes('piping') || lower.includes('pipe') || lower.includes('flange') || lower.includes('fitting')) return 'Valves';
  if (lower.includes('tank') || lower.includes('vessel')) return 'Storage Tank';
  if (lower.includes('exchanger') || lower.includes('heater') || lower.includes('cooler')) return 'Heat Exchanger';
  if (lower.includes('structure') || lower.includes('structural') || lower.includes('beam') || lower.includes('column')) return 'Structural';
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
  if (['job', 'jobs', 'ls', 'lump sum', 'lumpsum', 'mandays', 'manday', 'man-days', 'man-day'].includes(u)) {
    return 'Job';
  }
  return 'NOS'; // Default fallback
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
 * Parses products structurally from an Excel sheet.
 */
function parseExcelBOQ(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const products = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);
    if (!rows || rows.length === 0) continue;

    // Detect keys
    const firstRow = rows[0];
    const keys = Object.keys(firstRow);

    let titleKey = null;
    let descKey = null;
    let qtyKey = null;
    let unitKey = null;

    // Find title column
    titleKey = keys.find(k => {
      const l = k.toLowerCase();
      return l.includes('title') || l.includes('name') || l.includes('nomenclature');
    });

    // Find description column
    descKey = keys.find(k => {
      const l = k.toLowerCase();
      return l.includes('description') || l.includes('particulars') || l.includes('spec') || l.includes('valve') || l.includes('material description');
    });

    // If we only found description, check if it's actually the title column (or vice versa)
    if (!descKey && titleKey) descKey = titleKey;
    if (!titleKey && descKey) titleKey = descKey;
    
    // Fallback if none found
    if (!titleKey && !descKey) {
      titleKey = keys.find(k => typeof firstRow[k] === 'string' && firstRow[k].length > 10);
      descKey = titleKey;
    }
    if (!titleKey) titleKey = keys[0];
    if (!descKey) descKey = keys[0];

    // Find qty column
    qtyKey = keys.find(k => {
      const l = k.toLowerCase();
      // Exclude serial/item/sequence numbers
      const isSerialNumber = l.includes('number') && (
        l.includes('item') || l.includes('sr') || l.includes('sl') || 
        l.includes('serial') || l.includes('seq') || l.includes('code') || 
        l.includes('id') || l.includes('no')
      );
      if (isSerialNumber) return false;
      return l.includes('qty') || l.includes('quant') || l.includes('volume') || l.includes('item quantity') || l.includes('quantity');
    });

    if (!qtyKey) {
      qtyKey = keys.find(k => {
        const l = k.toLowerCase();
        // Check for 'nos' or 'number' fallback, still excluding serials
        const isSerialNumber = l.includes('number') && (
          l.includes('item') || l.includes('sr') || l.includes('sl') || 
          l.includes('serial') || l.includes('seq') || l.includes('code') || 
          l.includes('id') || l.includes('no')
        );
        if (isSerialNumber) return false;
        return l.includes('nos') || l.includes('number') || l.includes('count');
      });
    }

    if (!qtyKey) {
      qtyKey = keys.find(k => typeof firstRow[k] === 'number' && !k.toLowerCase().includes('sr') && !k.toLowerCase().includes('no') && !k.toLowerCase().includes('sl') && !k.toLowerCase().includes('item'));
    }

    // Find unit column
    unitKey = keys.find(k => {
      const l = k.toLowerCase();
      return l.includes('unit') || l.includes('uom') || l.includes('measure') || l.includes('rate') || l.includes('price');
    });

    for (const row of rows) {
      const titleVal = row[titleKey] ? String(row[titleKey]).trim() : '';
      const descVal = row[descKey] ? String(row[descKey]).trim() : '';

      // Determine the best description
      let finalDesc = '';
      if (titleVal && descVal) {
        if (isPlaceholderValue(descVal)) {
          finalDesc = titleVal;
        } else if (isPlaceholderValue(titleVal)) {
          finalDesc = descVal;
        } else if (titleVal.toLowerCase() === descVal.toLowerCase()) {
          finalDesc = titleVal;
        } else {
          finalDesc = `${titleVal} - ${descVal}`;
        }
      } else {
        finalDesc = titleVal || descVal;
      }

      if (!finalDesc || finalDesc.trim().length < 3) continue;

      let qtyVal = parseFloat(row[qtyKey]) || 1;
      let unitVal = row[unitKey] ? String(row[unitKey]).trim() : 'NOS';
      
      const lowerDesc = finalDesc.toLowerCase();
      if (lowerDesc.includes('total') || lowerDesc.includes('grand total') || lowerDesc.includes('signature') || lowerDesc.includes('summary')) {
        continue;
      }

      products.push({
        productDescription: finalDesc,
        quantity: qtyVal,
        unit: normalizeUnit(unitVal),
        productCategory: detectProductCategory(finalDesc),
        standardCode: detectStandardCode(finalDesc)
      });
    }
  }

  return products;
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
}

/**
 * Strips non-valve/non-enquiry sections from email body text.
 * Removes everything after boundary markers like "Product Details", "Terms & Conditions", etc.
 * This prevents lube oil tables, legal clauses, and signatures from polluting valve extraction.
 */
function stripNonValveSections(text) {
  if (!text) return '';

  const boundaries = [
    /^\s*product\s+details\s*[-:]/im,
    /^\s*terms\s+(?:&|and)\s+conditions/im,
    /^\s*commercial\s+terms/im,
    /^\s*general\s+notes?\s*:/im,
    /^\s*payment\s+terms/im,
    /^\s*delivery\s+terms/im,
    /^\s*\*?regards\*?\s*,?\s*$/im,
    /^\s*\*?thank(?:s|ing)\s+you\*?/im,
    /^\s*\*?best\s+regards\*?/im,
    /^\s*\*?warm\s+regards\*?/im
  ];

  let endIndex = text.length;
  for (const boundary of boundaries) {
    const match = text.match(boundary);
    if (match && match.index < endIndex) {
      endIndex = match.index;
    }
  }

  return text.substring(0, endIndex).trim();
}

/**
 * Deterministic email body line item parser.
 * Splits numbered/bulleted line items from email body text into separate products.
 *
 * Handles real-world formats:
 *   1  4" Shut off valve - pneumatic type  Suitable for 60 m3/hr  Nos. 16
 *   2. CS Ball Valve 100mm    15  Nos
 *   1) 100mm Gate Valve ... 8 Nos
 *
 * Also handles multi-line items where serial number, description, and quantity
 * are on separate lines.
 *
 * Returns [] if no serial-numbered items found (falls through to AI).
 */
function parseEmailBodyLineItems(bodyText) {
  if (!bodyText || typeof bodyText !== 'string') return [];

  // Step 1: Strip non-valve sections (lube oil, terms, signatures)
  const cleanedText = stripNonValveSections(bodyText);
  if (!cleanedText || cleanedText.trim().length < 10) return [];

  const lines = cleanedText.split('\n').map(l => l.trim()).filter(Boolean);
  const products = [];

  // ── Strategy 1: Single-line format ─────────────────────────────────────
  // Pattern: Sr.No + Description + ... + Nos./Qty + Number (or Number + Nos./Qty)
  //   1  4" Shut off valve - pneumatic type  Suitable for 60 m3/hr. flow rate  Nos. 16
  //   2  4" On Off Type Valve along with NO + NC contacts  Nos. 8
  //   3  4" Isolation Ball Valve  Nos. 8

  // Match: starts with a serial number, has description text, ends with quantity indicator
  // Pattern A: ... Nos./Qty.  <number>  (quantity at end after unit)
  const patternA = /^\s*(\d{1,3})\s*[.)\s]\s*(.+?)\s+(?:nos|qty|quantity|numbers?|pcs|sets?|ea|each)[.:]?\s*(\d+)\s*$/i;
  // Pattern B: ... <number>  Nos./Qty  (quantity before unit)
  const patternB = /^\s*(\d{1,3})\s*[.)\s]\s*(.+?)\s+(\d+)\s+(?:nos|qty|quantity|numbers?|pcs|sets?|ea|each)[.:]?\s*$/i;
  // Pattern C: ... Nos.  <number> (with period/colon after unit word, flexible spacing)
  const patternC = /^\s*(\d{1,3})\s*[.)\s]\s*(.+?)\s+(?:nos|qty|quantity)[.:]\s*(\d+)\s*$/i;

  for (const line of lines) {
    // Skip header-like lines
    if (/^\s*(?:sr\.?\s*no|sl\.?\s*no|s\.?\s*no|item|#|description|particular|detail)/i.test(line)) continue;
    if (/^\s*(?:unit|qty|quantity|nos|uom)\s*$/i.test(line)) continue;

    let match = line.match(patternA) || line.match(patternB) || line.match(patternC);
    if (match) {
      const desc = match[2].trim();
      const qty = parseInt(match[3], 10) || 1;

      // Validate: description must be at least 5 chars and contain letters
      if (desc.length >= 5 && /[a-zA-Z]/.test(desc)) {
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

  // If single-line strategy found items, return them
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
    const line = lines[i];

    // Check if this line is a standalone serial number (1-3 digits, nothing else)
    if (/^\d{1,3}$/.test(line.trim())) {
      const serialNum = parseInt(line.trim(), 10);
      // Collect subsequent description lines until we hit a unit/qty indicator
      let descParts = [];
      let qty = 1;
      let foundQty = false;
      let j = i + 1;

      while (j < lines.length) {
        const nextLine = lines[j].trim();

        // Check if this line is a unit indicator ("Nos.", "Qty", etc.)
        if (/^(?:nos|qty|quantity|numbers?|pcs|sets?|ea|each)[.:]?$/i.test(nextLine)) {
          // Next line should be the quantity number
          if (j + 1 < lines.length && /^\d+$/.test(lines[j + 1].trim())) {
            qty = parseInt(lines[j + 1].trim(), 10) || 1;
            foundQty = true;
            j += 2;
          } else {
            j++;
          }
          break;
        }

        // Check if this line is just a number (could be quantity)
        if (/^\d+$/.test(nextLine) && descParts.length > 0) {
          qty = parseInt(nextLine, 10) || 1;
          foundQty = true;
          j++;
          // Check if next line is a unit
          if (j < lines.length && /^(?:nos|qty|quantity|numbers?|pcs|sets?|ea|each)[.:]?$/i.test(lines[j].trim())) {
            j++;
          }
          break;
        }

        // Check if we hit another serial number (start of next item)
        if (/^\d{1,3}$/.test(nextLine) && parseInt(nextLine, 10) === serialNum + 1) {
          break;
        }

        // Check if we hit a section boundary
        if (/^(?:product\s+details|terms|regards|thank)/i.test(nextLine)) {
          break;
        }

        // Otherwise it's part of the description
        if (nextLine.length > 0 && /[a-zA-Z]/.test(nextLine)) {
          descParts.push(nextLine);
        }
        j++;
      }

      if (descParts.length > 0) {
        const fullDesc = descParts.join(' ').trim();
        if (fullDesc.length >= 5) {
          products.push({
            productDescription: fullDesc,
            quantity: qty,
            unit: normalizeUnit('NOS'),
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
  stripNonValveSections
};

/**
 * Deduplicates and merges products extracted from multiple sources (BOQ, specs, emails).
 * Part of Phase 5.
 */
function mergeEnquiryProducts(products) {
  const merged = [];

  const parseSize = (desc) => {
    const d = desc.toLowerCase();
    const match = d.match(/\b(\d+(?:\/\d+)?\s*(?:inch|in|nb|dn|\"|mm))/i) || d.match(/(?:^|\s)(dn\s*\d+|\d+\s*mm)/i);
    return match ? match[1].replace(/\s+/g, '').replace(/inch|in|dn|nb|mm|\"/g, '') : null;
  };

  const parseClass = (desc) => {
    const d = desc.toLowerCase();
    const match = d.match(/\b(\d+\s*#|\d+\s*class|class\s*\d+|#\s*\d+|\b\d+\s*lbs?)/i);
    return match ? match[1].replace(/\s+/g, '').replace(/class|lbs?|#/g, '') : null;
  };

  const parseMaterial = (desc) => {
    const d = desc.toLowerCase();
    const grades = [
      'a105', 'a 105', 'lf2', 'wcb', 'lcb', 'wcc', 'cf8m', 'cf8', 'cf3m', 'cf3',
      'f316l', 'f316', 'f304l', 'f304', 'ss316l', 'ss316', 'ss304l', 'ss304',
      'f51', 'f53', 'f55', 'monel', 'inconel', 'duplex', 'super duplex'
    ];
    for (const g of grades) {
      const regex = new RegExp('\\b' + g.replace('.', '\\.') + '\\b', 'i');
      if (regex.test(d)) {
        return g.replace(/\s+/g, '');
      }
    }
    if (/\b(carbon\s*steel|cs)\b/i.test(d)) return 'cs';
    if (/\b(stainless\s*steel|ss)\b/i.test(d)) return 'ss';
    if (/\b(alloy\s*steel|as)\b/i.test(d)) return 'as';
    return null;
  };

  const parseBore = (desc) => {
    const d = desc.toLowerCase();
    if (/\b(full\s*bore|fb)\b/i.test(d)) return 'fb';
    if (/\b(reduced\s*bore|rb|regular\s*bore)\b/i.test(d)) return 'rb';
    return null;
  };

  const parseOperation = (desc) => {
    const d = desc.toLowerCase();
    if (/\b(motorized|mov|motor\s*operated|actuated|actuator)\b/i.test(d)) return 'motorized';
    if (/\b(manual|lever|handwheel|handle|gear|hov)\b/i.test(d)) return 'manual';
    return null;
  };

  const parseValveType = (desc) => {
    const d = desc.toLowerCase();
    const types = ['ball', 'gate', 'globe', 'check', 'butterfly', 'plug', 'control', 'safety'];
    for (const t of types) {
      const regex = new RegExp('\\b' + t + '\\b', 'i');
      if (regex.test(d)) return t;
    }
    return null;
  };

  const parseEndConnection = (desc) => {
    const d = desc.toLowerCase();
    if (/\b(butt\s*weld|bw)\b/i.test(d)) return 'bw';
    if (/\b(socket\s*weld|sw)\b/i.test(d)) return 'sw';
    if (/\b(flanged|flange|fe|rf|rtj)\b/i.test(d)) return 'flanged';
    if (/\b(screwed|npt|nptf)\b/i.test(d)) return 'screwed';
    return null;
  };

  for (const prod of products) {
    const desc = prod.productDescription || prod.description || '';
    const size = parseSize(desc);
    const rating = parseClass(desc);
    const cat = (prod.productCategory || prod.category || '').toLowerCase();

    // Check if we already have a similar product in merged list
    let foundIdx = -1;
    for (let i = 0; i < merged.length; i++) {
      const other = merged[i];
      const otherDesc = other.productDescription || other.description || '';
      const otherSize = parseSize(otherDesc);
      const otherRating = parseClass(otherDesc);
      const otherCat = (other.productCategory || other.category || '').toLowerCase();

      const catMatch = cat === otherCat || cat === 'custom' || otherCat === 'custom';
      const sizeMatch = size && otherSize && size === otherSize;
      const ratingMatch = rating && otherRating && rating === otherRating;
      const descMatch = desc.toLowerCase().replace(/[^a-z0-9]/g, '') === otherDesc.toLowerCase().replace(/[^a-z0-9]/g, '');

      let isMatch = false;
      if (catMatch && descMatch) {
        isMatch = true;
      }

      if (isMatch) {
        foundIdx = i;
        break;
      }
    }

    if (foundIdx > -1) {
      const existing = merged[foundIdx];
      console.log(`[Product Merge] Merging duplicate products:\n  - Product A: "${existing.productDescription || existing.description}" (qty: ${existing.quantity})\n  - Product B: "${desc}" (qty: ${prod.quantity})`);
      
      existing.quantity += prod.quantity;
      if (desc.length > (existing.productDescription || existing.description || '').length) {
        if (existing.productDescription !== undefined) existing.productDescription = desc;
        if (existing.description !== undefined) existing.description = desc;
      }
      
      const newCat = prod.productCategory || prod.category;
      if (existing.productCategory === 'Custom' || !existing.productCategory) {
        existing.productCategory = newCat;
      }
      if (existing.category === 'Custom' || !existing.category) {
        existing.category = newCat;
      }

      if (existing.standardCode === 'Not specified' || !existing.standardCode) {
        existing.standardCode = prod.standardCode;
      }
      if (prod.linkedAttachmentNames) {
        existing.linkedAttachmentNames = [...new Set([...(existing.linkedAttachmentNames || []), ...prod.linkedAttachmentNames])];
      }
    } else {
      merged.push({ ...prod });
    }
  }

  return merged;
}

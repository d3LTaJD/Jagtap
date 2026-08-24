/**
 * HISTORICAL PRICING INTELLIGENCE SERVICE
 * Provides historical pricing suggestions and benchmark ranges for valve items
 * based on Valve Type, Size, Pressure Class, Material of Construction (MOC), and Standards.
 */

const Quotation = require('../models/Quotation');

// Helper to normalize strings for comparison
function norm(val) {
  if (!val) return '';
  return String(val).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Extract standard numeric size in mm
function extractSizeMm(sizeVal, descVal) {
  const str = `${sizeVal || ''} ${descVal || ''}`;
  
  // Direct mm match (e.g., 50mm, 100 mm)
  const mmMatch = str.match(/(\d+)\s*mm\b/i);
  if (mmMatch) return parseInt(mmMatch[1], 10);

  // Inch match (e.g. 1/2", 3/4", 1", 1.5", 2", 3", 4", 6", 8", 10", 12", 14", 16", 18", 20", 24")
  const fractionMatch = str.match(/(\d+)\/(\d+)\s*(?:inch|"|in)/i) || str.match(/\b(\d+)\/(\d+)\b/);
  if (fractionMatch) {
    const num = parseInt(fractionMatch[1], 10);
    const den = parseInt(fractionMatch[2], 10);
    const inches = num / den;
    return Math.round(inches * 25.4);
  }

  const inchMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:inch|"|in\b)/i);
  if (inchMatch) {
    const inches = parseFloat(inchMatch[1]);
    return Math.round(inches * 25.4);
  }

  const numOnly = parseInt(sizeVal, 10);
  if (!isNaN(numOnly) && numOnly > 0) {
    if (numOnly <= 24) return Math.round(numOnly * 25.4); // likely inches
    return numOnly; // likely mm
  }

  return 50; // default 2" (50mm)
}

// Extract pressure class number
function extractClass(classVal, descVal) {
  const str = `${classVal || ''} ${descVal || ''}`;
  const match = str.match(/(?:class|#|lb)?\s*(\d{3,4})\b/i) || str.match(/\b(150|300|600|800|900|1500|2500)\b/i);
  if (match) return parseInt(match[1], 10);
  return 150;
}

// Detect valve type
function detectValveType(typeVal, descVal, catVal) {
  const str = `${typeVal || ''} ${descVal || ''} ${catVal || ''}`.toLowerCase();
  if (str.includes('ball')) return 'Ball Valve';
  if (str.includes('gate') && !str.includes('knife')) return 'Gate Valve';
  if (str.includes('globe')) return 'Globe Valve';
  if (str.includes('check') || str.includes('nrv') || str.includes('non return')) return 'Check Valve';
  if (str.includes('butterfly')) return 'Butterfly Valve';
  if (str.includes('knife')) return 'Knife Gate Valve';
  return 'Ball Valve';
}

// Engineered Baseline Price Matrix (Base 50mm / 2" Class 150 WCB)
const BASE_PRICES = {
  'Ball Valve': 8500,
  'Gate Valve': 9800,
  'Globe Valve': 11200,
  'Check Valve': 7200,
  'Butterfly Valve': 5800,
  'Knife Gate Valve': 14500
};

// Size Multipliers (relative to 50mm)
function getSizeMultiplier(sizeMm) {
  if (sizeMm <= 15) return 0.45; // 1/2"
  if (sizeMm <= 20) return 0.55; // 3/4"
  if (sizeMm <= 25) return 0.68; // 1"
  if (sizeMm <= 40) return 0.85; // 1.5"
  if (sizeMm <= 50) return 1.00; // 2"
  if (sizeMm <= 80) return 1.65; // 3"
  if (sizeMm <= 100) return 2.45; // 4"
  if (sizeMm <= 150) return 4.80; // 6"
  if (sizeMm <= 200) return 7.90; // 8"
  if (sizeMm <= 250) return 12.50; // 10"
  if (sizeMm <= 300) return 18.20; // 12"
  if (sizeMm <= 350) return 24.00; // 14"
  if (sizeMm <= 400) return 32.50; // 16"
  if (sizeMm <= 500) return 52.00; // 20"
  if (sizeMm <= 600) return 78.00; // 24"
  return (sizeMm / 50) * 2.2;
}

// Class Multipliers (relative to 150#)
function getClassMultiplier(pressureClass) {
  if (pressureClass <= 150) return 1.0;
  if (pressureClass <= 300) return 1.45;
  if (pressureClass <= 600) return 2.25;
  if (pressureClass <= 800) return 1.95; // Forged 800#
  if (pressureClass <= 900) return 3.40;
  if (pressureClass <= 1500) return 4.60;
  if (pressureClass <= 2500) return 6.80;
  return 1.0;
}

// MOC Multipliers (relative to Carbon Steel WCB / A105)
function getMocMultiplier(mocVal) {
  const m = norm(mocVal);
  if (m.includes('cf8m') || m.includes('316') || m.includes('f316')) return 2.15; // SS316
  if (m.includes('cf8') || m.includes('304') || m.includes('f304')) return 1.65; // SS304
  if (m.includes('cf3m') || m.includes('316l')) return 2.30;
  if (m.includes('cn7m') || m.includes('alloy20')) return 3.80;
  if (m.includes('duplex') || m.includes('2205') || m.includes('4a')) return 3.20;
  if (m.includes('superduplex') || m.includes('2507') || m.includes('5a')) return 4.50;
  if (m.includes('monel') || m.includes('inconel') || m.includes('hastelloy')) return 5.50;
  if (m.includes('wcc') || m.includes('lcb') || m.includes('lcc')) return 1.25;
  return 1.0; // WCB / A105 default
}

/**
 * Calculate pricing suggestion for a single item specification
 * @param {Object} item - Line item from quotation
 * @param {String} excludeQuotationId - ID of current quotation to avoid self-referencing
 */
async function getItemPricingSuggestion(item, excludeQuotationId = null) {
  const sizeMm = extractSizeMm(item.size || item.dynamicFields?.valve_size, item.description);
  const pressureClass = extractClass(item.pressureClass || item.dynamicFields?.valve_class, item.description);
  const valveType = detectValveType(item.valveType || item.dynamicFields?.valve_type, item.description, item.productCategory);
  const moc = item.materialGrade || item.dynamicFields?.valve_moc_body || 'ASTM A216 WCB';

  // 1. Query past quotations from database if connected
  let historicalSamples = [];
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState === 1) {
    try {
      const query = {
        'items.unitPrice': { $gt: 0 }
      };
      if (excludeQuotationId) {
        query._id = { $ne: excludeQuotationId };
      }

      const pastQuotes = await Quotation.find(query)
        .select('quotationId items createdAt status')
        .sort({ createdAt: -1 })
        .limit(60)
        .lean();

      pastQuotes.forEach(q => {
        (q.items || []).forEach(pi => {
          if (!pi.unitPrice || pi.unitPrice <= 0) return;

          const pSize = extractSizeMm(pi.size || pi.dynamicFields?.valve_size, pi.description);
          const pClass = extractClass(pi.pressureClass || pi.dynamicFields?.valve_class, pi.description);
          const pType = detectValveType(pi.valveType || pi.dynamicFields?.valve_type, pi.description, pi.productCategory);
          const pMoc = pi.materialGrade || pi.dynamicFields?.valve_moc_body || '';

          // Match criteria: Same valve type, similar size (+/- 20%), same class
          const isTypeMatch = pType === valveType;
          const isClassMatch = Math.abs(pClass - pressureClass) <= 50;
          const isSizeMatch = Math.abs(pSize - sizeMm) <= 15;
          const isMocMatch = norm(pMoc) === norm(moc);

          if (isTypeMatch && isClassMatch && isSizeMatch) {
            historicalSamples.push({
              unitPrice: pi.unitPrice,
              quotationId: q.quotationId,
              date: q.createdAt,
              mocMatch: isMocMatch
            });
          }
        });
      });
    } catch (err) {
      console.error('Error querying historical quotation pricing:', err);
    }
  }

  // 2. Compute Benchmark / Baseline Pricing
  const basePrice = BASE_PRICES[valveType] || 8500;
  const sizeMult = getSizeMultiplier(sizeMm);
  const classMult = getClassMultiplier(pressureClass);
  const mocMult = getMocMultiplier(moc);

  const engineeredPrice = Math.round(basePrice * sizeMult * classMult * mocMult);
  const engineeredMin = Math.round(engineeredPrice * 0.93 / 100) * 100;
  const engineeredMax = Math.round(engineeredPrice * 1.08 / 100) * 100;

  // 3. Blend with Historical Data if available
  let minPrice, maxPrice, avgPrice, confidence, sampleCount, lastQuotedPrice, lastQuotedDate;

  if (historicalSamples.length >= 3) {
    const prices = historicalSamples.map(s => s.unitPrice);
    minPrice = Math.min(...prices);
    maxPrice = Math.max(...prices);
    avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    confidence = 'HIGH';
    sampleCount = historicalSamples.length;
    lastQuotedPrice = historicalSamples[0].unitPrice;
    lastQuotedDate = historicalSamples[0].date;
  } else if (historicalSamples.length > 0) {
    const prices = historicalSamples.map(s => s.unitPrice);
    const histAvg = prices.reduce((a, b) => a + b, 0) / prices.length;
    avgPrice = Math.round((histAvg * 0.6 + engineeredPrice * 0.4) / 100) * 100;
    minPrice = Math.min(Math.round(avgPrice * 0.94 / 100) * 100, Math.min(...prices));
    maxPrice = Math.max(Math.round(avgPrice * 1.06 / 100) * 100, Math.max(...prices));
    confidence = 'MEDIUM';
    sampleCount = historicalSamples.length;
    lastQuotedPrice = historicalSamples[0].unitPrice;
    lastQuotedDate = historicalSamples[0].date;
  } else {
    minPrice = engineeredMin;
    maxPrice = engineeredMax;
    avgPrice = engineeredPrice;
    confidence = 'BASELINE';
    sampleCount = 0;
    lastQuotedPrice = null;
    lastQuotedDate = null;
  }

  const formatRupee = (v) => `₹${Number(v).toLocaleString('en-IN')}`;

  return {
    lineItemId: item.lineItemId,
    itemNo: item.itemNo,
    valveType,
    sizeMm,
    sizeInches: (sizeMm / 25.4).toFixed(1).replace(/\.0$/, '') + '"',
    pressureClass: `${pressureClass}#`,
    materialGrade: moc,
    minPrice,
    maxPrice,
    avgPrice,
    formattedRange: `${formatRupee(minPrice)} – ${formatRupee(maxPrice)}`,
    formattedAvg: formatRupee(avgPrice),
    confidence,
    sampleCount,
    lastQuotedPrice: lastQuotedPrice ? formatRupee(lastQuotedPrice) : null,
    lastQuotedDate: lastQuotedDate ? new Date(lastQuotedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null,
    recommendationNote: sampleCount > 0 
      ? `Based on ${sampleCount} past quote(s) for ${valveType} ${sizeMm}mm ${pressureClass}# (${moc}).`
      : `Based on standard engineered manufacturing index for ${valveType} ${sizeMm}mm ${pressureClass}# (${moc}).`
  };
}

/**
 * Get pricing suggestions for all items in a quotation
 * @param {Array} items - Quotation line items
 * @param {String} quotationId - Quotation ID
 */
async function getQuotationPricingSuggestions(items, quotationId = null) {
  const suggestions = {};
  for (let idx = 0; idx < (items || []).length; idx++) {
    const it = items[idx];
    const key = it.lineItemId || `idx_${idx}`;
    suggestions[key] = await getItemPricingSuggestion(it, quotationId);
  }
  return suggestions;
}

module.exports = {
  getItemPricingSuggestion,
  getQuotationPricingSuggestions,
  extractSizeMm,
  extractClass,
  detectValveType
};

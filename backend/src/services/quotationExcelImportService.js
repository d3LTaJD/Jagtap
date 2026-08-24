const XLSX = require('xlsx');

/**
 * QUOTATION EXCEL IMPORT & VALIDATION SERVICE
 * Strictly validates uploaded XLSX spreadsheets against quotation database records.
 * Protects database integrity with partial import checks, quantity locks, and boundary validation.
 */

function parseAndValidatePricingSpreadsheet(fileBuffer, quotation) {
  const dbItems = quotation.items || [];
  const errors = [];
  const warnings = [];
  
  let workbook;
  try {
    workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  } catch (err) {
    return {
      isValid: false,
      errors: [`Unable to parse Excel file: ${err.message}`],
      warnings: [],
      updatedItems: []
    };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      isValid: false,
      errors: ['The uploaded workbook contains no worksheets.'],
      warnings: [],
      updatedItems: []
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (!rows || rows.length < 5) {
    return {
      isValid: false,
      errors: ['Excel file format is invalid or has too few rows to contain quotation pricing data.'],
      warnings: [],
      updatedItems: []
    };
  }

  // Check Quotation ID in header rows (row 0-3)
  let foundQuotationId = null;
  for (let r = 0; r < Math.min(4, rows.length); r++) {
    const rowStr = rows[r].join(' ');
    const match = rowStr.match(/QT-\d{4}-\d{2}-\d{4}/i);
    if (match) {
      foundQuotationId = match[0].toUpperCase();
      break;
    }
  }

  if (foundQuotationId && quotation.quotationId && foundQuotationId !== quotation.quotationId.toUpperCase()) {
    warnings.push(`Quotation ID in Excel (${foundQuotationId}) differs from the target quotation (${quotation.quotationId}). Proceed only if this is intended.`);
  }

  // Find column header row (looks for "Line Item ID" or "Base Unit Price")
  let headerRowIndex = -1;
  for (let r = 0; r < Math.min(10, rows.length); r++) {
    const row = rows[r].map(c => String(c).trim().toLowerCase());
    if (row.includes('line item id') || (row.includes('base unit price (₹)') || row.includes('base unit price') || row.includes('unit rate'))) {
      headerRowIndex = r;
      break;
    }
  }

  if (headerRowIndex === -1) {
    return {
      isValid: false,
      errors: ['Could not find standard table headers ("Line Item ID", "Base Unit Price", etc.) in the uploaded spreadsheet.'],
      warnings,
      updatedItems: []
    };
  }

  const header = rows[headerRowIndex].map(c => String(c).trim().toLowerCase());
  
  const colIndex = {
    lineItemId: header.findIndex(c => c.includes('line item id')),
    offerSr: header.findIndex(c => c.includes('offer sr')),
    enquirySr: header.findIndex(c => c.includes('enquiry sr')),
    description: header.findIndex(c => c.includes('description')),
    quantity: header.findIndex(c => c === 'quantity' || c === 'qty'),
    unitPrice: header.findIndex(c => c.includes('base unit price') || c.includes('unit price') || c === 'base rate (₹)' || c === 'base rate'),
    discount: header.findIndex(c => c.includes('discount')),
    ndt: header.findIndex(c => c.includes('ndt')),
    specialTesting: header.findIndex(c => c.includes('special testing')),
    spares: header.findIndex(c => c.includes('spares')),
    pf: header.findIndex(c => c.includes('p&f') || c.includes('pf')),
    tpia: header.findIndex(c => c.includes('tpia') || c.includes('tpi'))
  };

  if (colIndex.unitPrice === -1) {
    return {
      isValid: false,
      errors: ['Column "Base Unit Price (₹)" is missing from the Excel file.'],
      warnings,
      updatedItems: []
    };
  }

  // Build lookup index of DB items by lineItemId, _id, and itemNo
  const dbItemMap = new Map();
  const dbLineIds = new Set();

  dbItems.forEach((item, idx) => {
    const canonicalLineId = item.lineItemId || (item._id ? `LI-${item._id.toString().slice(-6).toUpperCase()}` : `LI-${String(idx + 1).padStart(5, '0')}`);
    dbItemMap.set(canonicalLineId, { item, idx });
    if (item._id) dbItemMap.set(item._id.toString(), { item, idx });
    dbItemMap.set(String(item.itemNo || idx + 1), { item, idx });
    dbLineIds.add(canonicalLineId);
  });

  const seenExcelLineIds = new Set();
  const updatedItemsMap = new Map();

  // Process data rows
  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0 || row.every(cell => String(cell).trim() === '')) {
      continue; // Skip empty rows
    }

    const rawLineId = colIndex.lineItemId !== -1 ? String(row[colIndex.lineItemId] || '').trim() : '';
    const rawOfferSr = colIndex.offerSr !== -1 ? String(row[colIndex.offerSr] || '').trim() : '';
    const rowIdentifier = rawLineId || rawOfferSr;

    if (!rowIdentifier) {
      continue; // Skip footer or unlabelled rows
    }

    // Resolve matching DB item
    let match = null;
    if (rawLineId && dbItemMap.has(rawLineId)) {
      match = dbItemMap.get(rawLineId);
    } else if (rawOfferSr && dbItemMap.has(rawOfferSr)) {
      match = dbItemMap.get(rawOfferSr);
    }

    if (!match) {
      errors.push(`Row ${r + 1}: Line item "${rowIdentifier}" does not match any line item in this quotation.`);
      continue;
    }

    const { item: originalItem, idx: itemIdx } = match;
    const lineKey = originalItem.lineItemId || `LI-${String(itemIdx + 1).padStart(5, '0')}`;

    if (seenExcelLineIds.has(lineKey)) {
      errors.push(`Row ${r + 1}: Duplicate line item identifier "${rowIdentifier}" found in Excel.`);
      continue;
    }
    seenExcelLineIds.add(lineKey);

    // Quantity Verification
    if (colIndex.quantity !== -1) {
      const excelQty = Number(row[colIndex.quantity]);
      if (!isNaN(excelQty) && excelQty > 0 && Math.abs(excelQty - (originalItem.quantity || 1)) > 0.001) {
        warnings.push(`Item ${lineKey} (${originalItem.description}): Quantity in Excel (${excelQty}) differs from quotation quantity (${originalItem.quantity || 1}). Quotation quantity will be preserved.`);
      }
    }

    // Numeric parsing helper with boundary validation
    const parsePriceField = (val, fieldName, min = 0, max = Infinity) => {
      if (val === '' || val === null || val === undefined) return 0;
      const num = Number(String(val).replace(/[^\d.-]/g, ''));
      if (isNaN(num)) {
        errors.push(`Row ${r + 1} (${lineKey}): Invalid non-numeric value "${val}" for ${fieldName}.`);
        return 0;
      }
      if (num < min) {
        errors.push(`Row ${r + 1} (${lineKey}): ${fieldName} (${num}) cannot be less than ${min}.`);
        return 0;
      }
      if (num > max) {
        errors.push(`Row ${r + 1} (${lineKey}): ${fieldName} (${num}) exceeds maximum allowed value of ${max}.`);
        return max;
      }
      return num;
    };

    const unitPrice = parsePriceField(row[colIndex.unitPrice], 'Base Unit Price', 0);
    const discountPercent = colIndex.discount !== -1 ? parsePriceField(row[colIndex.discount], 'Discount %', 0, 100) : (originalItem.discountPercent || 0);
    const ndtCharges = colIndex.ndt !== -1 ? parsePriceField(row[colIndex.ndt], 'NDT Charges', 0) : (originalItem.ndtCharges || 0);
    const specialTestingCharges = colIndex.specialTesting !== -1 ? parsePriceField(row[colIndex.specialTesting], 'Special Testing', 0) : (originalItem.specialTestingCharges || 0);
    const sparesCharges = colIndex.spares !== -1 ? parsePriceField(row[colIndex.spares], 'Spares Charges', 0) : (originalItem.sparesCharges || 0);
    const pfCharges = colIndex.pf !== -1 ? parsePriceField(row[colIndex.pf], 'P&F Charges', 0) : (originalItem.pfCharges || 0);
    const tpiCharges = colIndex.tpia !== -1 ? parsePriceField(row[colIndex.tpia], 'TPIA Charges', 0) : (originalItem.tpiCharges || 0);

    const qty = Number(originalItem.quantity) || 1;
    const effectiveUnitRate = Math.round(((unitPrice * (1 - discountPercent / 100)) + ndtCharges + specialTestingCharges + sparesCharges + pfCharges + tpiCharges) * 100) / 100;
    const lineTotalExclGST = Math.round(effectiveUnitRate * qty * 100) / 100;
    const gstAmount = Math.round(lineTotalExclGST * 0.18 * 100) / 100;
    const lineTotalInclGST = Math.round((lineTotalExclGST + gstAmount) * 100) / 100;

    updatedItemsMap.set(itemIdx, {
      ...originalItem,
      unitPrice,
      discountPercent,
      ndtCharges,
      specialTestingCharges,
      sparesCharges,
      pfCharges,
      tpiCharges,
      lineTotalExclGST,
      gstAmount,
      lineTotalInclGST
    });
  }

  // Detect Missing Rows (Partial Import Detection)
  const missingItemIds = [];
  dbItems.forEach((item, idx) => {
    const canonicalLineId = item.lineItemId || `LI-${String(idx + 1).padStart(5, '0')}`;
    if (!seenExcelLineIds.has(canonicalLineId)) {
      missingItemIds.push({
        lineItemId: canonicalLineId,
        itemNo: item.itemNo || idx + 1,
        description: item.description || `Item #${idx + 1}`,
        quantity: item.quantity || 1
      });
    }
  });

  const requiresPartialConfirmation = missingItemIds.length > 0;
  if (requiresPartialConfirmation) {
    warnings.push(`Excel file contains ${seenExcelLineIds.size} of ${dbItems.length} items. ${missingItemIds.length} items are omitted in the Excel sheet and will remain unchanged in the database.`);
  }

  // Build the complete updated items array
  const finalItems = dbItems.map((originalItem, idx) => {
    if (updatedItemsMap.has(idx)) {
      return updatedItemsMap.get(idx);
    }
    return originalItem; // Keep unchanged
  });

  const isValid = errors.length === 0;

  return {
    isValid,
    requiresPartialConfirmation,
    missingItemIds,
    updatedCount: updatedItemsMap.size,
    totalDbItems: dbItems.length,
    excelItemsCount: seenExcelLineIds.size,
    errors,
    warnings,
    updatedItems: finalItems
  };
}

module.exports = {
  parseAndValidatePricingSpreadsheet
};

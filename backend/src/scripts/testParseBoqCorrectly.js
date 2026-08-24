const XLSX = require('xlsx');
const fs = require('fs');

const path = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\BOQ_321105.xls';
const boqBuf = fs.readFileSync(path);

function extractCleanBoqItems(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const allProducts = [];

  for (const sheetName of workbook.SheetNames) {
    // Skip macro sheets or non-data sheets
    if (/macro|instruction|summary|help|guideline/i.test(sheetName)) continue;

    const sheet = workbook.Sheets[sheetName];
    // Convert to raw 2D array of rows
    const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!rawMatrix || rawMatrix.length === 0) continue;

    console.log(`Processing Sheet "${sheetName}", Total raw rows: ${rawMatrix.length}`);

    // Step 1: Find the real header row index (looking for 'Item Description', 'Description', 'Quantity', 'Qty', 'Sl. No', etc.)
    let headerRowIdx = -1;
    let colMap = {
      itemNo: -1,
      desc: -1,
      itemCode: -1,
      qty: -1,
      unit: -1,
      destination: -1
    };

    for (let r = 0; r < Math.min(rawMatrix.length, 30); r++) {
      const row = rawMatrix[r].map(c => String(c).trim().toLowerCase());
      const hasDesc = row.some(c => c.includes('description') || c.includes('item desc') || c.includes('particulars'));
      const hasQty = row.some(c => c === 'quantity' || c === 'qty' || c.includes('qty') || c.includes('quantity'));
      
      if (hasDesc && (hasQty || row.some(c => c.includes('unit') || c.includes('sl') || c.includes('item')))) {
        headerRowIdx = r;
        console.log(`Found Header Row at index ${r}:`, rawMatrix[r].filter(Boolean));

        // Map column indices
        rawMatrix[r].forEach((colVal, colIdx) => {
          const c = String(colVal).trim().toLowerCase();
          if (colMap.itemNo === -1 && (c.includes('sl') || c.includes('item no') || c.includes('item wise') || c === 'item' || c.includes('sr'))) {
            colMap.itemNo = colIdx;
          }
          if (colMap.desc === -1 && (c.includes('description') || c.includes('particular') || c.includes('item desc'))) {
            colMap.desc = colIdx;
          }
          if (colMap.itemCode === -1 && (c.includes('code') || c.includes('make') || c.includes('item code'))) {
            colMap.itemCode = colIdx;
          }
          if (colMap.qty === -1 && (c === 'quantity' || c === 'qty' || c.includes('quantity') || c.includes('qty'))) {
            colMap.qty = colIdx;
          }
          if (colMap.unit === -1 && (c.includes('unit') || c.includes('uom') || c === 'units')) {
            colMap.unit = colIdx;
          }
          if (colMap.destination === -1 && (c.includes('destination') || c.includes('delivery site') || c.includes('location'))) {
            colMap.destination = colIdx;
          }
        });
        break;
      }
    }

    console.log('Column Map:', colMap);

    if (headerRowIdx === -1) {
      console.warn(`Could not find header row in sheet ${sheetName}, using fallback.`);
      continue;
    }

    // Step 2: Iterate through rows AFTER headerRowIdx
    for (let r = headerRowIdx + 1; r < rawMatrix.length; r++) {
      const row = rawMatrix[r];
      if (!row || row.length === 0) continue;

      const itemNoRaw = colMap.itemNo !== -1 ? String(row[colMap.itemNo] || '').trim() : '';
      const descRaw = colMap.desc !== -1 ? String(row[colMap.desc] || '').trim() : '';
      const qtyRaw = colMap.qty !== -1 ? row[colMap.qty] : '';
      const unitRaw = colMap.unit !== -1 ? String(row[colMap.unit] || '').trim() : 'NOS';
      const destRaw = colMap.destination !== -1 ? String(row[colMap.destination] || '').trim() : '';

      // Skip empty descriptions
      if (!descRaw || descRaw.length < 3) continue;

      // Skip non-item summary/footer rows
      const lowerDesc = descRaw.toLowerCase();
      if (/total in figures|quoted rate|total amount|grand total|words/i.test(descRaw) ||
          /total in figures|quoted rate|total amount|grand total|words/i.test(itemNoRaw)) {
        continue;
      }

      // Skip header numbering row (e.g. 1, 2, 3, 4, 5...)
      if (/^\d+$/.test(itemNoRaw) && Number(itemNoRaw) === 1 && String(row[colMap.desc]).trim() === '2') {
        continue;
      }

      // Skip generic instruction/preamble row
      // e.g. "Supply of CS Ball Valves as per Technical Specifications... FB = Full Bore BW = Butt Welded"
      if (/^supply of .* as per technical specifications/i.test(descRaw) && (!qtyRaw || isNaN(Number(qtyRaw)))) {
        continue;
      }

      // Filter out garbage / non-item text like "Construction of chamber for 100mm sluices valve"
      if (/construction of chamber/i.test(descRaw)) {
        continue;
      }

      let quantity = Number(qtyRaw);
      if (isNaN(quantity) || quantity <= 0) {
        // If quantity is missing or not a number, check if this is an item row or a header/note
        // If it's a section header without quantity, skip it
        continue;
      }

      // Clean itemNo
      let cleanItemNo = itemNoRaw;
      if (!cleanItemNo && /^\d+(\.\d+)?/.test(descRaw)) {
        const m = descRaw.match(/^(\d+(\.\d+)?)/);
        cleanItemNo = m ? m[1] : '';
      }

      allProducts.push({
        itemNo: cleanItemNo || `${allProducts.length + 1}`,
        description: descRaw,
        quantity: quantity,
        unit: unitRaw || 'NOS',
        destination: destRaw,
        category: 'Valves'
      });
    }
  }

  return allProducts;
}

const items = extractCleanBoqItems(boqBuf);
console.log(`\n==================================================`);
console.log(`TOTAL CLEAN BOQ ITEMS EXTRACTED: ${items.length}`);
console.log(`==================================================\n`);

items.forEach((it, idx) => {
  console.log(`${idx + 1}. [Item ${it.itemNo}] ${it.description} | Qty: ${it.quantity} ${it.unit} | Site: ${it.destination}`);
});

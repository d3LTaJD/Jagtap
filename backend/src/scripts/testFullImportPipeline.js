const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const XLSX = require('xlsx');
const fileParsingService = require('../services/fileParsingService');
const tenderIntelligenceService = require('../services/tenderIntelligenceService');
const extractionPipeline = require('../services/extraction/ExtractionPipeline');
const FieldDefinition = require('../models/FieldDefinition');
const boqParserService = require('../services/boqParserService');

const boqPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\BOQ_321105.xls';
const pdfPath = 'd:\\jagtap\\A002_MNGL_26-27-20260624T190541Z-3-001\\A002_MNGL_26-27\\Tender_CSBV_26-27_16.pdf';

async function testFullImport() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/petro-valve');
  console.log('✓ Connected to MongoDB');

  const boqBuf = fs.readFileSync(boqPath);
  const pdfBuf = fs.readFileSync(pdfPath);

  // 1. Parse BOQ
  const workbook = XLSX.read(boqBuf, { type: 'buffer' });
  const products = [];

  for (const sheetName of workbook.SheetNames) {
    if (/macro|instruction|summary|help|guideline/i.test(sheetName)) continue;
    const sheet = workbook.Sheets[sheetName];
    const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!rawMatrix || rawMatrix.length === 0) continue;

    let headerRowIdx = -1;
    let colMap = { itemNo: -1, desc: -1, itemCode: -1, qty: -1, unit: -1, destination: -1 };

    for (let r = 0; r < Math.min(rawMatrix.length, 30); r++) {
      const row = rawMatrix[r].map(c => String(c).trim().toLowerCase());
      const hasDesc = row.some(c => c.includes('description') || c.includes('item desc') || c.includes('particulars'));
      const hasQty = row.some(c => c === 'quantity' || c === 'qty' || c.includes('qty') || c.includes('quantity'));
      
      if (hasDesc && (hasQty || row.some(c => c.includes('unit') || c.includes('sl') || c.includes('item')))) {
        headerRowIdx = r;
        rawMatrix[r].forEach((colVal, colIdx) => {
          const c = String(colVal).trim().toLowerCase();
          if (colMap.itemNo === -1 && (c.includes('sl') || c.includes('item no') || c.includes('item wise') || c === 'item' || c.includes('sr'))) colMap.itemNo = colIdx;
          if (colMap.desc === -1 && (c.includes('description') || c.includes('particular') || c.includes('item desc'))) colMap.desc = colIdx;
          if (colMap.itemCode === -1 && (c.includes('code') || c.includes('make') || c.includes('item code'))) colMap.itemCode = colIdx;
          if (colMap.qty === -1 && (c === 'quantity' || c === 'qty' || c.includes('quantity') || c.includes('qty'))) colMap.qty = colIdx;
          if (colMap.unit === -1 && (c.includes('unit') || c.includes('uom') || c === 'units')) colMap.unit = colIdx;
          if (colMap.destination === -1 && (c.includes('destination') || c.includes('delivery site') || c.includes('location'))) colMap.destination = colIdx;
        });
        break;
      }
    }

    if (headerRowIdx === -1) continue;

    for (let r = headerRowIdx + 1; r < rawMatrix.length; r++) {
      const row = rawMatrix[r];
      if (!row || row.length === 0) continue;

      const itemNoRaw = colMap.itemNo !== -1 ? String(row[colMap.itemNo] || '').trim() : '';
      const descRaw = colMap.desc !== -1 ? String(row[colMap.desc] || '').trim() : '';
      const qtyRaw = colMap.qty !== -1 ? row[colMap.qty] : '';
      const unitRaw = colMap.unit !== -1 ? String(row[colMap.unit] || '').trim() : 'NOS';
      const destRaw = colMap.destination !== -1 ? String(row[colMap.destination] || '').trim() : '';

      if (!descRaw || descRaw.length < 3) continue;
      if (/total in figures|quoted rate|total amount|grand total|words/i.test(descRaw) ||
          /total in figures|quoted rate|total amount|grand total|words/i.test(itemNoRaw)) continue;
      if (/^\d+$/.test(itemNoRaw) && Number(itemNoRaw) === 1 && String(row[colMap.desc]).trim() === '2') continue;
      if (/^supply of .* as per technical specifications/i.test(descRaw) && (!qtyRaw || isNaN(Number(qtyRaw)))) continue;
      if (/construction of chamber/i.test(descRaw)) continue;

      let quantity = Number(qtyRaw);
      if (isNaN(quantity) || quantity <= 0) continue;

      let cleanItemNo = itemNoRaw;
      if (!cleanItemNo && /^\d+(\.\d+)?/.test(descRaw)) {
        const m = descRaw.match(/^(\d+(\.\d+)?)/);
        cleanItemNo = m ? m[1] : '';
      }

      products.push({
        itemNo: cleanItemNo || `${products.length + 1}`,
        description: descRaw,
        quantity,
        unit: boqParserService.normalizeUnit(unitRaw),
        destination: destRaw,
        category: 'Valves',
        dynamicFields: {}
      });
    }
  }

  console.log(`\n✓ BOQ Extraction: ${products.length} products found (Expected 12).`);

  // 2. Parse Spec PDF
  const parseResult = await fileParsingService.extractTextFromFile(pdfBuf, 'application/pdf', 'Tender_CSBV_26-27_16.pdf');
  const specText = parseResult.text || '';
  console.log(`✓ Spec PDF Text Extracted: ${specText.length} characters.`);

  // 3. Extract Dynamic Fields for each product using ExtractionPipeline / Engineering Rules
  const valveFields = await FieldDefinition.find({
    productCategory: 'Valves',
    formContext: 'Enquiry',
    isDeleted: false,
    isActive: true
  });
  console.log(`✓ Loaded ${valveFields.length} active Valve field definitions.`);

  for (let i = 0; i < products.length; i++) {
    const prod = products[i];
    const combinedContext = `${prod.description}\n\n${specText.slice(0, 15000)}`;
    const gatedResult = await extractionPipeline.processProductGatedPipeline({
      textContext: combinedContext,
      fieldDefinitions: valveFields,
      productDescription: prod.description,
      enquiryId: null,
      productIndex: i
    });

    prod.dynamicFields = gatedResult.validatedDynamicFields;
    console.log(`Product ${i + 1} (${prod.itemNo}): Size=${prod.dynamicFields.valve_size}, Class=${prod.dynamicFields.valve_class}, Type=${prod.dynamicFields.valve_type}, End=${prod.dynamicFields.valve_end_connection}`);
  }

  // 4. Extract Tender Intelligence
  const fullContext = specText + '\n\n' + products.map(p => p.description).join('\n');
  const ti = await tenderIntelligenceService.extractTenderIntelligence(fullContext, ['BOQ_321105.xls', 'Tender_CSBV_26-27_16.pdf'], 'IMPORT_TENDER');
  console.log('\n✓ Tender Intelligence:');
  console.log('  Customer:', ti.tenderDetails?.customer);
  console.log('  Tender No:', ti.tenderDetails?.gemTenderNo);
  console.log('  Bid Deadline:', ti.tenderTimeline?.bidSubmissionDate);
  console.log('  Contact:', ti.contactPersons?.[0]);

  await mongoose.disconnect();
}

testFullImport().catch(console.error);

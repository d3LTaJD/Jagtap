const XLSX = require('xlsx');
const { calculateQuotationPricing } = require('../utils/quotationCalculator');

/**
 * QUOTATION EXCEL EXPORT SERVICE
 * Exports quotation in the exact Zoho WorkDrive "Offer Formates.xlsx" -> "Price Part-II" format.
 * Format No. R/5.1.3.5/2 Rev04.
 * NDT, TPIA, and Special Testing are quotation-level common charges, not separate per-item charge additions.
 */

function generateQuotationPricingWorkbook(quotation) {
  const pricing = calculateQuotationPricing(quotation);
  const items = pricing.items || quotation.items || [];

  // Rows 1-5 Header
  const noticeText = quotation.pricePartNotice || 'We offer our Valves as below, considering Contract Review Check (Format No. R/5.1.3.5/2 Rev04).';

  // Build grid data (AOA)
  // Row 1: blank
  // Row 2: PRICE PART – II
  // Row 3: blank
  // Row 4: Bullet notice
  // Row 5: blank
  // Row 6-16: Table matrix
  const row1 = [];
  const row2 = ['', '', '', '', '', 'PRICE PART – II'];
  const row3 = [];
  const row4 = ['• ' + noticeText];
  const row5 = [];

  const rowEnquirySr = ['Enquiry Sr. NO.', '', '', '', ''];
  const rowValveType = ['Valve Type', '', '', '', ''];
  const rowSizeMm = ['Size in MM', '', '', '', ''];
  const rowClass = ['Class', '', '', '', ''];
  const rowQuantity = ['Qunatity', '', '', '', ''];
  const rowUnitPrice = ['Unit Price', '', '', '', ''];
  const rowNDT = ['Any NDT Requirement (i.e. RT,UT,MPT) then charges will be Extra at actual to your account.', '', '', '', ''];
  const rowSpecTest = ['If any Special Testing Requirement (i.e. Helium, Nitrogen, Vaccum, IGC, PMI, NACE, Paint) then charges will be Extra at actual to your account.', '', '', '', ''];
  const rowSpares = ['Spares, Manday required then charges will be Extra at actual to your account.', '', '', '', ''];
  const rowUnitRate = ['Unit Rate', '', '', '', ''];
  const rowTotalRate = ['Total Rate', '', '', '', ''];

  const totalCols = Math.max(10, items.length);

  for (let idx = 0; idx < totalCols; idx++) {
    const item = items[idx];
    if (!item) {
      rowEnquirySr.push(0);
      rowValveType.push(0);
      rowSizeMm.push(0);
      rowClass.push(0);
      rowQuantity.push('');
      rowUnitPrice.push('');
      rowNDT.push('');
      rowSpecTest.push(0);
      rowSpares.push(0);
      rowUnitRate.push(0);
      rowTotalRate.push(0);
      continue;
    }

    const enquirySr = item.enquirySrNo || item.itemNo || idx + 1;
    const valveType = item.dynamicFields?.valve_type || item.productCategory || 'BALL';
    const size = item.size || item.dynamicFields?.valve_size || item.dynamicFields?.size || '-';
    const pressureClass = item.pressureClass || item.dynamicFields?.valve_class || item.dynamicFields?.class || '-';
    const qty = Number(item.quantity) || 1;
    const unitPrice = Number(item.unitPrice) || 0;
    const unitRate = Number(item.unitRate) || Math.round(unitPrice * (1 - (Number(item.discountPercent) || 0) / 100));
    const totalRate = Number(item.lineTotalExclGST) || (unitRate * qty);

    // NDT resolution
    let ndtStr = item.ndtRequirement || item.dynamicFields?.ndt_requirement || item.dynamicFields?.ndt_applicable;
    if (!ndtStr || String(ndtStr).trim() === '' || String(ndtStr).trim() === '-') {
      const rt = String(item.dynamicFields?.valve_test_rt || item.dynamicFields?.test_rt || '').toLowerCase();
      const ut = String(item.dynamicFields?.valve_test_ut || item.dynamicFields?.test_ut || '').toLowerCase();
      const mpt = String(item.dynamicFields?.valve_test_mpt || item.dynamicFields?.test_mpt || '').toLowerCase();
      const dpt = String(item.dynamicFields?.valve_test_dpt || item.dynamicFields?.test_dpt || '').toLowerCase();
      const parts = [];
      if (rt.includes('yes') || rt.includes('applicable')) parts.push('RT');
      if (ut.includes('yes') || ut.includes('applicable')) parts.push('UT');
      if (mpt.includes('yes') || mpt.includes('applicable')) parts.push('MPT');
      if (dpt.includes('yes') || dpt.includes('applicable')) parts.push('DPT');

      if (parts.length > 0) {
        ndtStr = `${parts.join(', ')} Applicable`;
      } else {
        const sizeNum = Number(String(size).replace(/\D/g, '')) || 0;
        const classStr = String(pressureClass).trim();
        if (classStr === '800' || (sizeNum > 0 && sizeNum <= 40)) {
          ndtStr = 'UT Applicable';
        } else {
          ndtStr = 'RT Applicable';
        }
      }
    }

    rowEnquirySr.push(enquirySr);
    rowValveType.push(valveType);
    rowSizeMm.push(size);
    rowClass.push(pressureClass);
    rowQuantity.push(qty);
    rowUnitPrice.push(unitPrice);
    rowNDT.push(ndtStr);
    rowSpecTest.push(pricing.specialTestingAmount > 0 ? pricing.specialTestingAmount : 0);
    rowSpares.push(pricing.sparesAmount > 0 ? pricing.sparesAmount : 0);
    rowUnitRate.push(unitRate);
    rowTotalRate.push(totalRate);
  }

  const rowBlank17 = [];
  const rowCert32 = ['Extra for 3.2 Certificataton Charges.', '', '', '', `${pricing.cert32Percent}%`, pricing.cert32Amount];
  const rowPf = ['Extra for Packing & Forwarding Charges', '', '', '', `${pricing.pfPercent}%`, pricing.pfAmount];
  const rowTpi = ['Third Party Inspection (TPIA) required then charges will be Extra to your account.', '', '', '', '', pricing.tpiAmount || 0];
  const rowNdtCommon = pricing.ndtAmount > 0 ? ['Any NDT Requirement Charges (Common across all items)', '', '', '', '', pricing.ndtAmount] : null;
  const rowSpecTestCommon = pricing.specialTestingAmount > 0 ? ['Special Testing Requirement Charges (Common across all items)', '', '', '', '', pricing.specialTestingAmount] : null;
  const rowSparesCommon = pricing.sparesAmount > 0 ? ['Spares, Manday required charges (Common across all items)', '', '', '', '', pricing.sparesAmount] : null;
  const rowSubtotal = ['Grand Total (Inc. TPI, P&F, Certi., etc.)', '', '', '', '', pricing.grandTotalBeforeGST];
  const rowGst = [`${pricing.gstRate}%GST`, '', '', '', `${pricing.gstRate}%`, pricing.gstAmount];
  const rowGrandTotal = ['Grand Total With GST', '', '', '', '', pricing.grandTotalWithGST];

  const data = [
    row1,
    row2,
    row3,
    row4,
    row5,
    rowEnquirySr,
    rowValveType,
    rowSizeMm,
    rowClass,
    rowQuantity,
    rowUnitPrice,
    rowNDT,
    rowSpecTest,
    rowSpares,
    rowUnitRate,
    rowTotalRate,
    rowBlank17,
    rowCert32,
    rowPf,
    rowTpi,
    rowNdtCommon,
    rowSpecTestCommon,
    rowSparesCommon,
    rowSubtotal,
    rowGst,
    rowGrandTotal
  ];

  const ws = XLSX.utils.aoa_to_sheet(data.filter(Boolean));

  // Set column widths
  const colWidths = [
    { wch: 46 }, // Col A (Labels)
    { wch: 12 }, // Col B
    { wch: 12 }, // Col C
    { wch: 12 }, // Col D
    { wch: 14 }  // Col E
  ];

  // Each item column
  for (let c = 0; c < totalCols; c++) {
    colWidths.push({ wch: 18 });
  }

  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Price Part-II');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  generateQuotationPricingWorkbook
};

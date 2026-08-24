const XLSX = require('xlsx');

/**
 * QUOTATION EXCEL EXPORT SERVICE
 * Exports quotation line items with permanent lineItemIds and pricing structure.
 */

function generateQuotationPricingWorkbook(quotation) {
  const items = quotation.items || [];
  
  // Prepare header info rows
  const data = [
    ['QUOTATION PRICING SCHEDULE - PETRO VALVES'],
    ['Quotation ID:', quotation.quotationId || '', 'Date:', new Date().toLocaleDateString('en-GB'), 'Customer:', quotation.customer?.companyName || quotation.customerName || ''],
    ['Enquiry Ref:', quotation.enquiry?.enquiryNumber || '', 'Project:', quotation.projectName || ''],
    [], // Blank separator row
    [
      'Line Item ID',
      'Offer Sr.',
      'Enquiry Sr.',
      'Item Description',
      'Size',
      'Class',
      'Material (MOC)',
      'Quantity',
      'Unit',
      'Base Unit Price (₹)',
      'Discount (%)',
      'NDT Charges (₹)',
      'Special Testing (₹)',
      'Spares Charges (₹)',
      'P&F Charges (₹)',
      'TPIA Charges (₹)',
      'Calculated Unit Rate (₹)',
      'Line Total Excl GST (₹)'
    ]
  ];

  // Map each item to row data
  items.forEach((item, idx) => {
    const lineId = item.lineItemId || (item._id ? `LI-${item._id.toString().slice(-6).toUpperCase()}` : `LI-${String(idx + 1).padStart(5, '0')}`);
    const size = item.size || item.dynamicFields?.valve_size || item.dynamicFields?.size || '-';
    const pressureClass = item.pressureClass || item.dynamicFields?.valve_class || item.dynamicFields?.class || '-';
    const moc = item.materialGrade || item.dynamicFields?.valve_body_moc || item.dynamicFields?.body_material || '-';
    const qty = Number(item.quantity) || 1;
    const unitPrice = Number(item.unitPrice) || 0;
    const discount = Number(item.discountPercent) || 0;
    const ndt = Number(item.ndtCharges) || 0;
    const specTest = Number(item.specialTestingCharges) || 0;
    const spares = Number(item.sparesCharges) || 0;
    const pf = Number(item.pfCharges) || 0;
    const tpia = Number(item.tpiCharges) || 0;

    const effectiveUnitRate = Math.round(((unitPrice * (1 - discount / 100)) + ndt + specTest + spares + pf + tpia) * 100) / 100;
    const lineTotal = Math.round(effectiveUnitRate * qty * 100) / 100;

    data.push([
      lineId,
      item.itemNo || idx + 1,
      item.enquirySrNo || idx + 1,
      item.description || `Item #${idx + 1}`,
      size,
      pressureClass,
      moc,
      qty,
      item.unit || 'NOS',
      unitPrice,
      discount,
      ndt,
      specTest,
      spares,
      pf,
      tpia,
      effectiveUnitRate,
      lineTotal
    ]);
  });

  // Create workbook and worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 14 }, // Line Item ID
    { wch: 10 }, // Offer Sr.
    { wch: 12 }, // Enquiry Sr.
    { wch: 45 }, // Description
    { wch: 12 }, // Size
    { wch: 12 }, // Class
    { wch: 22 }, // MOC
    { wch: 10 }, // Quantity
    { wch: 8 },  // Unit
    { wch: 18 }, // Base Unit Price
    { wch: 14 }, // Discount %
    { wch: 16 }, // NDT Charges
    { wch: 18 }, // Special Testing
    { wch: 18 }, // Spares Charges
    { wch: 16 }, // P&F Charges
    { wch: 16 }, // TPIA Charges
    { wch: 22 }, // Calculated Unit Rate
    { wch: 22 }  // Line Total Excl GST
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Price Part-II');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  generateQuotationPricingWorkbook
};

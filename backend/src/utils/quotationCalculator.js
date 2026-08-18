/**
 * Centralized Quotation Pricing & Commercial Calculator
 * Aligned with Offer Formates Excel & Price Part-II specifications.
 */

function calculateItemPricing(item) {
  if (!item) return item;
  const quantity = item.quantity !== undefined && item.quantity !== null ? Number(item.quantity) : 1;
  const unitPrice = Number(item.unitPrice) || 0;
  const ndtCharges = Number(item.ndtCharges) || 0;
  const specialTestingCharges = Number(item.specialTestingCharges) || 0;
  const sparesCharges = Number(item.sparesCharges) || 0;
  const cert32Charges = Number(item.cert32Charges) || 0;
  const pfCharges = Number(item.pfCharges) || 0;
  const tpiCharges = Number(item.tpiCharges) || 0;
  const discountPercent = Number(item.discountPercent) || 0;

  const unitRateBeforeDiscount = unitPrice + ndtCharges + specialTestingCharges + sparesCharges + cert32Charges + pfCharges + tpiCharges;
  const unitRate = unitRateBeforeDiscount * (1 - discountPercent / 100);
  const lineTotalExclGST = unitRate * quantity;

  return {
    ...item,
    quantity,
    unitPrice,
    ndtCharges,
    specialTestingCharges,
    sparesCharges,
    cert32Charges,
    pfCharges,
    tpiCharges,
    discountPercent,
    unitRateBeforeDiscount,
    unitRate,
    lineTotalExclGST
  };
}

function calculateQuotationPricing(quotationOrItems, options = {}) {
  let items = [];
  let opts = {};

  if (Array.isArray(quotationOrItems)) {
    items = quotationOrItems;
    opts = options || {};
  } else if (quotationOrItems && typeof quotationOrItems === 'object') {
    items = Array.isArray(quotationOrItems.items) ? quotationOrItems.items : [];
    opts = { ...quotationOrItems, ...options };
  } else {
    opts = options || {};
  }

  const processedItems = items.map(calculateItemPricing);
  const baseTotalRateSum = processedItems.reduce((acc, item) => acc + (item.lineTotalExclGST || 0), 0);

  const cert32Percent = opts.cert32Percent !== undefined && opts.cert32Percent !== null ? Number(opts.cert32Percent) : 5;
  const pfPercent = opts.pfPercent !== undefined && opts.pfPercent !== null ? Number(opts.pfPercent) : 5;
  const gstRate = opts.gstRate !== undefined && opts.gstRate !== null ? Number(opts.gstRate) : 18;

  let tpiAmount = 0;
  if (opts.tpiCharges !== undefined && opts.tpiCharges !== null) {
    tpiAmount = Number(opts.tpiCharges);
  } else if (opts.commercialTotals?.totalInspectionCharges !== undefined && opts.commercialTotals.totalInspectionCharges !== null) {
    tpiAmount = Number(opts.commercialTotals.totalInspectionCharges);
  } else if (opts.commercialTotals?.tpiAmount !== undefined && opts.commercialTotals.tpiAmount !== null) {
    tpiAmount = Number(opts.commercialTotals.tpiAmount);
  } else {
    tpiAmount = 0;
  }

  const cert32Amount = (baseTotalRateSum * cert32Percent) / 100;
  const pfAmount = (baseTotalRateSum * pfPercent) / 100;

  const grandTotalBeforeGST = baseTotalRateSum + cert32Amount + pfAmount + tpiAmount;
  const gstAmount = grandTotalBeforeGST * (gstRate / 100);
  const grandTotalWithGST = grandTotalBeforeGST + gstAmount;

  return {
    items: processedItems,
    baseTotalRateSum,
    subtotalExclGST: baseTotalRateSum,
    cert32Percent,
    cert32Amount,
    pfPercent,
    pfAmount,
    tpiAmount,
    tpiCharges: tpiAmount,
    grandTotalBeforeGST,
    taxableAmount: grandTotalBeforeGST,
    gstRate,
    gstAmount,
    grandTotalWithGST,
    grandTotal: grandTotalWithGST,
    commercialTotals: {
      subtotalExclGST: baseTotalRateSum,
      cert32Percent,
      cert32Amount,
      pfPercent,
      pfAmount,
      tpiAmount,
      totalInspectionCharges: tpiAmount,
      grandTotalBeforeGST,
      taxableAmount: grandTotalBeforeGST,
      gstRate,
      totalGST: gstAmount,
      grandTotal: grandTotalWithGST
    }
  };
}

module.exports = {
  calculateItemPricing,
  calculateQuotationPricing
};

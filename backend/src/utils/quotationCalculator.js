/**
 * Centralized Quotation Pricing & Commercial Calculator
 * Aligned with Offer Formates Excel & Price Part-II specifications.
 */

function roundCurrency(value) {
  if (value === undefined || value === null || isNaN(value)) return 0;
  return Math.round(Number(value) * 100) / 100;
}

function calculateItemPricing(item) {
  if (!item) return item;
  const quantity = item.quantity !== undefined && item.quantity !== null ? Number(item.quantity) : 1;
  const unitPrice = Number(item.unitPrice) || 0;
  const discountPercent = Number(item.discountPercent) || 0;

  // In accordance with Price Part-II format: NDT, TPIA, and Spec Test are common for all, NOT separate per-item charges
  const unitRateBeforeDiscount = roundCurrency(unitPrice);
  const unitRate = roundCurrency(unitRateBeforeDiscount * (1 - discountPercent / 100));
  const lineTotalExclGST = roundCurrency(unitRate * quantity);

  return {
    ...item,
    quantity,
    unitPrice,
    ndtCharges: 0,
    specialTestingCharges: 0,
    sparesCharges: 0,
    cert32Charges: 0,
    pfCharges: 0,
    tpiCharges: 0,
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
  const baseTotalRateSum = roundCurrency(processedItems.reduce((acc, item) => acc + (item.lineTotalExclGST || 0), 0));

  const cert32Percent = opts.cert32Percent !== undefined && opts.cert32Percent !== null ? Number(opts.cert32Percent) : 5;
  const pfPercent = opts.pfPercent !== undefined && opts.pfPercent !== null ? Number(opts.pfPercent) : 5;
  const gstRate = opts.gstRate !== undefined && opts.gstRate !== null ? Number(opts.gstRate) : 18;

  const ndtAmount = roundCurrency(opts.ndtCharges !== undefined ? opts.ndtCharges : (opts.commercialTotals?.ndtAmount || 0));
  const specialTestingAmount = roundCurrency(opts.specialTestingCharges !== undefined ? opts.specialTestingCharges : (opts.commercialTotals?.specialTestingAmount || 0));
  const sparesAmount = roundCurrency(opts.sparesCharges !== undefined ? opts.sparesCharges : (opts.commercialTotals?.sparesAmount || 0));

  let tpiAmount = 0;
  if (opts.tpiCharges !== undefined && opts.tpiCharges !== null) {
    tpiAmount = roundCurrency(opts.tpiCharges);
  } else if (opts.commercialTotals?.totalInspectionCharges !== undefined && opts.commercialTotals.totalInspectionCharges !== null) {
    tpiAmount = roundCurrency(opts.commercialTotals.totalInspectionCharges);
  } else if (opts.commercialTotals?.tpiAmount !== undefined && opts.commercialTotals.tpiAmount !== null) {
    tpiAmount = roundCurrency(opts.commercialTotals.tpiAmount);
  } else {
    tpiAmount = 0;
  }

  const cert32Amount = roundCurrency((baseTotalRateSum * cert32Percent) / 100);
  const pfAmount = roundCurrency((baseTotalRateSum * pfPercent) / 100);

  const grandTotalBeforeGST = roundCurrency(
    baseTotalRateSum + cert32Amount + pfAmount + tpiAmount + ndtAmount + specialTestingAmount + sparesAmount
  );
  const gstAmount = roundCurrency(grandTotalBeforeGST * (gstRate / 100));
  const grandTotalWithGST = roundCurrency(grandTotalBeforeGST + gstAmount);

  return {
    items: processedItems,
    baseTotalRateSum,
    subtotalExclGST: baseTotalRateSum,
    ndtCharges: ndtAmount,
    ndtAmount,
    specialTestingCharges: specialTestingAmount,
    specialTestingAmount,
    sparesCharges: sparesAmount,
    sparesAmount,
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
      ndtAmount,
      specialTestingAmount,
      sparesAmount,
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
  roundCurrency,
  calculateItemPricing,
  calculateQuotationPricing
};

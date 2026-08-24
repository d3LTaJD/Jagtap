/**
 * QUOTATION DIFF & CHANGE DETECTION SERVICE
 * Compares two quotation states (e.g., Last Sent Revision Snapshot vs Current Working State)
 * and generates structured, categorized change logs.
 */

function formatCurrency(val) {
  const num = Number(val) || 0;
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function normalizeStr(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

/**
 * Compare two quotation states and return a detailed diff object.
 * @param {Object} oldState - Snapshot object or previous quotation state
 * @param {Object} newState - Current quotation state or updated snapshot
 */
function computeQuotationDiff(oldState, newState) {
  if (!oldState) {
    return {
      hasChanges: false,
      isInitial: true,
      totalChangeCount: 0,
      itemDiffs: [],
      specDiffs: [],
      termsDiffs: [],
      totalsDiff: null,
      summaryTextList: ['Initial quotation creation (Rev 00)']
    };
  }

  const oldItems = oldState.items || [];
  const newItems = newState.items || [];
  const oldComm = oldState.commFields || oldState;
  const newComm = newState.commFields || newState;
  const oldPrice = oldState.priceFields || oldState;
  const newPrice = newState.priceFields || newState;
  const oldTotals = oldState.commercialTotals || {};
  const newTotals = newState.commercialTotals || {};

  const itemDiffs = [];
  const specDiffs = [];
  const termsDiffs = [];
  const summaryTextList = [];

  // 1. Line Item Matching by lineItemId or Index
  const oldItemMap = new Map();
  oldItems.forEach((item, idx) => {
    const key = item.lineItemId || `IDX-${idx}`;
    oldItemMap.set(key, { ...item, originalIdx: idx });
  });

  const newItemMap = new Map();
  newItems.forEach((item, idx) => {
    const key = item.lineItemId || `IDX-${idx}`;
    newItemMap.set(key, { ...item, originalIdx: idx });
  });

  // A. Detect Added Items
  newItems.forEach((newItem, idx) => {
    const key = newItem.lineItemId || `IDX-${idx}`;
    if (!oldItemMap.has(key)) {
      const desc = newItem.description || `Item #${newItem.itemNo || idx + 1}`;
      itemDiffs.push({
        type: 'ITEM_ADDED',
        lineItemId: newItem.lineItemId,
        itemNo: newItem.itemNo || idx + 1,
        description: desc,
        quantity: newItem.quantity || 1,
        unitPrice: newItem.unitPrice || 0,
        lineTotal: newItem.lineTotalExclGST || 0,
        details: `Added new item: ${desc} (Qty: ${newItem.quantity || 1}, Base Price: ${formatCurrency(newItem.unitPrice)})`
      });
      summaryTextList.push(`Added Line Item #${newItem.itemNo || idx + 1}: ${desc}`);
    }
  });

  // B. Detect Removed Items
  oldItems.forEach((oldItem, idx) => {
    const key = oldItem.lineItemId || `IDX-${idx}`;
    if (!newItemMap.has(key)) {
      const desc = oldItem.description || `Item #${oldItem.itemNo || idx + 1}`;
      itemDiffs.push({
        type: 'ITEM_REMOVED',
        lineItemId: oldItem.lineItemId,
        itemNo: oldItem.itemNo || idx + 1,
        description: desc,
        details: `Removed item: ${desc} (was Qty: ${oldItem.quantity || 1})`
      });
      summaryTextList.push(`Removed Line Item #${oldItem.itemNo || idx + 1}: ${desc}`);
    }
  });

  // C. Detect Modified Items (Pricing & Quantities)
  newItems.forEach((newItem, idx) => {
    const key = newItem.lineItemId || `IDX-${idx}`;
    const oldItem = oldItemMap.get(key);
    if (oldItem) {
      const changes = [];

      if (Number(oldItem.quantity) !== Number(newItem.quantity)) {
        changes.push({
          field: 'quantity',
          label: 'Quantity',
          oldVal: oldItem.quantity,
          newVal: newItem.quantity
        });
      }

      if (Number(oldItem.unitPrice || 0) !== Number(newItem.unitPrice || 0)) {
        changes.push({
          field: 'unitPrice',
          label: 'Base Unit Price',
          oldVal: formatCurrency(oldItem.unitPrice),
          newVal: formatCurrency(newItem.unitPrice)
        });
      }

      if (Number(oldItem.discountPercent || 0) !== Number(newItem.discountPercent || 0)) {
        changes.push({
          field: 'discountPercent',
          label: 'Discount',
          oldVal: `${oldItem.discountPercent || 0}%`,
          newVal: `${newItem.discountPercent || 0}%`
        });
      }

      if (Number(oldItem.ndtCharges || 0) !== Number(newItem.ndtCharges || 0)) {
        changes.push({
          field: 'ndtCharges',
          label: 'NDT Charges',
          oldVal: formatCurrency(oldItem.ndtCharges),
          newVal: formatCurrency(newItem.ndtCharges)
        });
      }

      if (Number(oldItem.specialTestingCharges || 0) !== Number(newItem.specialTestingCharges || 0)) {
        changes.push({
          field: 'specialTestingCharges',
          label: 'Special Testing',
          oldVal: formatCurrency(oldItem.specialTestingCharges),
          newVal: formatCurrency(newItem.specialTestingCharges)
        });
      }

      if (Number(oldItem.sparesCharges || 0) !== Number(newItem.sparesCharges || 0)) {
        changes.push({
          field: 'sparesCharges',
          label: 'Spares Charges',
          oldVal: formatCurrency(oldItem.sparesCharges),
          newVal: formatCurrency(newItem.sparesCharges)
        });
      }

      if (Number(oldItem.pfCharges || 0) !== Number(newItem.pfCharges || 0)) {
        changes.push({
          field: 'pfCharges',
          label: 'P&F Charges',
          oldVal: formatCurrency(oldItem.pfCharges),
          newVal: formatCurrency(newItem.pfCharges)
        });
      }

      if (Number(oldItem.tpiCharges || 0) !== Number(newItem.tpiCharges || 0)) {
        changes.push({
          field: 'tpiCharges',
          label: 'TPIA Charges',
          oldVal: formatCurrency(oldItem.tpiCharges),
          newVal: formatCurrency(newItem.tpiCharges)
        });
      }

      if (Number(oldItem.lineTotalExclGST || 0) !== Number(newItem.lineTotalExclGST || 0)) {
        changes.push({
          field: 'lineTotalExclGST',
          label: 'Line Total',
          oldVal: formatCurrency(oldItem.lineTotalExclGST),
          newVal: formatCurrency(newItem.lineTotalExclGST)
        });
      }

      // Check MOC / Specs
      const oldMoc = normalizeStr(oldItem.materialGrade || oldItem.dynamicFields?.valve_body_moc);
      const newMoc = normalizeStr(newItem.materialGrade || newItem.dynamicFields?.valve_body_moc);
      if (oldMoc && newMoc && oldMoc !== newMoc) {
        changes.push({
          field: 'materialGrade',
          label: 'MOC (Material Grade)',
          oldVal: oldMoc,
          newVal: newMoc
        });
      }

      const oldSize = normalizeStr(oldItem.size || oldItem.dynamicFields?.valve_size);
      const newSize = normalizeStr(newItem.size || newItem.dynamicFields?.valve_size);
      if (oldSize && newSize && oldSize !== newSize) {
        changes.push({
          field: 'size',
          label: 'Size (MM)',
          oldVal: oldSize,
          newVal: newSize
        });
      }

      const oldClass = normalizeStr(oldItem.pressureClass || oldItem.dynamicFields?.valve_class);
      const newClass = normalizeStr(newItem.pressureClass || newItem.dynamicFields?.valve_class);
      if (oldClass && newClass && oldClass !== newClass) {
        changes.push({
          field: 'pressureClass',
          label: 'Pressure Class',
          oldVal: oldClass,
          newVal: newClass
        });
      }

      if (changes.length > 0) {
        const desc = newItem.description || `Item #${newItem.itemNo || idx + 1}`;
        itemDiffs.push({
          type: 'ITEM_MODIFIED',
          lineItemId: newItem.lineItemId,
          itemNo: newItem.itemNo || idx + 1,
          description: desc,
          changes
        });
        const changeLabels = changes.map(c => `${c.label}: ${c.oldVal} → ${c.newVal}`).join(', ');
        summaryTextList.push(`Item #${newItem.itemNo || idx + 1} (${desc}): ${changeLabels}`);
      }
    }
  });

  // 2. Commercial Terms Comparison
  const termFields = [
    { key: 'deliverySchedule', label: 'Delivery Schedule' },
    { key: 'paymentTerms', label: 'Payment Terms' },
    { key: 'priceBasis', label: 'Price Basis' },
    { key: 'validityTerms', label: 'Validity' },
    { key: 'guaranteeTerms', label: 'Guarantee / Warranty' },
    { key: 'packingForwardingTerms', label: 'P&F Terms' },
    { key: 'freightTerms', label: 'Freight Terms' },
    { key: 'taxDutyTerms', label: 'Taxes & Duties (GST)' },
    { key: 'tpiTerms', label: 'TPIA Terms' }
  ];

  termFields.forEach(({ key, label }) => {
    const oldVal = normalizeStr(oldComm[key]);
    const newVal = normalizeStr(newComm[key]);
    if (oldVal && newVal && oldVal !== newVal) {
      termsDiffs.push({
        field: key,
        label,
        oldVal,
        newVal
      });
      summaryTextList.push(`${label} changed: "${oldVal.slice(0, 35)}..." → "${newVal.slice(0, 35)}..."`);
    }
  });

  // 3. Commercial Totals Comparison
  let totalsDiff = null;
  const oldGrandTotal = Number(oldTotals.grandTotal || oldTotals.grandTotalWithGST || 0);
  const newGrandTotal = Number(newTotals.grandTotal || newTotals.grandTotalWithGST || 0);
  const oldSubtotal = Number(oldTotals.subtotalExclGST || oldTotals.baseTotalRateSum || 0);
  const newSubtotal = Number(newTotals.subtotalExclGST || newTotals.baseTotalRateSum || 0);

  if (oldGrandTotal !== newGrandTotal || oldSubtotal !== newSubtotal) {
    const diffAmount = Math.round((newGrandTotal - oldGrandTotal) * 100) / 100;
    const diffPercent = oldGrandTotal > 0 ? Math.round(((newGrandTotal - oldGrandTotal) / oldGrandTotal) * 1000) / 10 : 0;
    totalsDiff = {
      oldSubtotal: formatCurrency(oldSubtotal),
      newSubtotal: formatCurrency(newSubtotal),
      oldGrandTotal: formatCurrency(oldGrandTotal),
      newGrandTotal: formatCurrency(newGrandTotal),
      diffAmount,
      diffPercent,
      formattedDiff: `${diffAmount >= 0 ? '+' : ''}${formatCurrency(diffAmount)} (${diffPercent >= 0 ? '+' : ''}${diffPercent}%)`
    };
    summaryTextList.push(`Grand Total changed from ${formatCurrency(oldGrandTotal)} to ${formatCurrency(newGrandTotal)} (${totalsDiff.formattedDiff})`);
  }

  const totalChangeCount = itemDiffs.length + termsDiffs.length + (totalsDiff ? 1 : 0);
  const hasChanges = totalChangeCount > 0;

  return {
    hasChanges,
    isInitial: false,
    totalChangeCount,
    itemDiffs,
    specDiffs,
    termsDiffs,
    totalsDiff,
    summaryTextList
  };
}

module.exports = {
  computeQuotationDiff,
  formatCurrency
};

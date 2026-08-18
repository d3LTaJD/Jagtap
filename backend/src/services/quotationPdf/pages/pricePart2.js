const { renderHeader } = require('../components/Header');
const { renderOfficialFooter } = require('../components/Footer');
const { formatPdfValue, extractItemFieldValue, formatINR } = require('../dataFormatter');
const { calculateQuotationPricing } = require('../../../utils/quotationCalculator');

function renderPricePart2(quotation) {
  const pricing = calculateQuotationPricing(quotation);
  const items = pricing.items || [];

  const notice = formatPdfValue(
    quotation.pricingNoticeText || quotation.pricePartNotice,
    'Above mentioned rates are for supply of valves as per given in CONTRACT REVIEW CHECKLIST.'
  );

  const totalCols = Math.max(items.length, 8);
  const colIndices = Array.from({ length: totalCols }, (_, i) => i);

  const computedItems = colIndices.map(i => {
    const item = items[i];
    if (!item) {
      return {
        sr: i + 1,
        hasItem: false,
        valveType: '0',
        size: '0',
        itemClass: '0',
        qty: 0,
        unitPrice: 0,
        ndtText: 'Extra at actual',
        spares: 0,
        specTest: 0,
        unitRate: 0,
        totalRate: 0
      };
    }

    const valveType = extractItemFieldValue(item, 'valve_type', 'VALVE');
    const size = extractItemFieldValue(item, 'valve_size', '-');
    const itemClass = extractItemFieldValue(item, 'valve_class', '-');
    
    const qty = Number(item.quantity) || 1;
    const unitPrice = Number(item.unitPrice) || 0;
    const specTest = Number(item.specialTestingCharges) || 0;
    const spares = Number(item.sparesCharges) || 0;
    const unitRate = Number(item.unitRate) || 0;
    const totalRate = Number(item.lineTotalExclGST) || 0;

    const rt = extractItemFieldValue(item, 'valve_test_rt', 'No');
    const ut = extractItemFieldValue(item, 'valve_test_ut', 'No');
    const dpt = extractItemFieldValue(item, 'valve_test_dpt', 'No');
    const mpt = extractItemFieldValue(item, 'valve_test_mpt', 'No');
    
    const ndtParts = [];
    if (String(rt).toLowerCase().includes('yes')) ndtParts.push('RT');
    if (String(ut).toLowerCase().includes('yes')) ndtParts.push('UT');
    if (String(dpt).toLowerCase().includes('yes')) ndtParts.push('DPT');
    if (String(mpt).toLowerCase().includes('yes')) ndtParts.push('MPT');
    
    let ndtText = ndtParts.length > 0 ? ndtParts.join(', ') : 'No';

    return {
      sr: i + 1,
      hasItem: true,
      valveType,
      size,
      itemClass,
      qty,
      unitPrice,
      ndtText,
      spares,
      specTest,
      unitRate,
      totalRate
    };
  });

  return `
    <div class="pv-page">
      <div class="pv-page-content">
        ${renderHeader()}

        <div class="pv-section-title" style="margin-top: 10px; margin-bottom: 12px;">
          PRICE PART – II
        </div>

        <div class="pv-price-intro">
          &bull; ${notice}
        </div>

        <!-- Pricing Matrix Table -->
        <table class="pv-price-table">
          <thead>
            <tr>
              <th class="pv-price-label-col">Enquiry Sr. NO.</th>
              ${computedItems.map(c => `<th>${c.sr}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="pv-price-label-col">Valve Type</td>
              ${computedItems.map(c => `<td>${c.hasItem ? c.valveType : '0'}</td>`).join('')}
            </tr>
            <tr>
              <td class="pv-price-label-col">Size in MM</td>
              ${computedItems.map(c => `<td>${c.hasItem ? c.size : '0'}</td>`).join('')}
            </tr>
            <tr>
              <td class="pv-price-label-col">Class</td>
              ${computedItems.map(c => `<td>${c.hasItem ? c.itemClass : '0'}</td>`).join('')}
            </tr>
            <tr>
              <td class="pv-price-label-col">Qunatity</td>
              ${computedItems.map(c => `<td>${c.hasItem ? c.qty : ''}</td>`).join('')}
            </tr>
            <tr>
              <td class="pv-price-label-col">Unit Price</td>
              ${computedItems.map(c => `<td>${c.hasItem ? formatINR(c.unitPrice) : ''}</td>`).join('')}
            </tr>
            <tr>
              <td class="pv-price-label-col" style="font-size: 7px; line-height: 1.1;">
                Any NDT Requirement<br/>
                (i.e. RT,UT,MPT) then <strong>charges will be Extra at actual to your account.</strong>
              </td>
              ${computedItems.map(c => `<td style="font-size: 7px;">${c.hasItem ? c.ndtText : ''}</td>`).join('')}
            </tr>
            <tr>
              <td class="pv-price-label-col" style="font-size: 7px; line-height: 1.1;">
                If any Special Testing Requirement<br/>
                (i.e. Helium, Nitrogen, Vaccum, IGC, PMI, NACE, Paint) then <strong>charges will be Extra at actual to your account.</strong>
              </td>
              ${computedItems.map(c => `<td>${c.hasItem && c.specTest > 0 ? formatINR(c.specTest) : '₹ 0'}</td>`).join('')}
            </tr>
            <tr>
              <td class="pv-price-label-col" style="font-size: 7px; line-height: 1.1;">
                Spares, Manday required then <strong>charges will be Extra at actual to your account.</strong>
              </td>
              ${computedItems.map(c => `<td>${c.hasItem ? formatINR(c.spares) : '₹ 0'}</td>`).join('')}
            </tr>
            <tr style="background-color: #fafafa;">
              <td class="pv-price-label-col">Unit Rate</td>
              ${computedItems.map(c => `<td>${c.hasItem ? formatINR(c.unitRate) : '₹ 0'}</td>`).join('')}
            </tr>
            <tr style="background-color: #f5f5f5; font-weight: bold;">
              <td class="pv-price-label-col">Total Rate</td>
              ${computedItems.map(c => `<td>${c.hasItem ? formatINR(c.totalRate) : '₹ 0'}</td>`).join('')}
            </tr>
          </tbody>
        </table>

        <!-- Commercial Summary Rows Below Matrix Table -->
        <table class="pv-price-table" style="margin-top: 10px;">
          <tbody>
            <tr>
              <td class="pv-price-summary-label" style="width: 220px;">
                Extra for 3.2 Certificatation Charges.
              </td>
              <td style="width: 60px; text-align: center; font-weight: bold;">
                ${pricing.cert32Percent}%
              </td>
              <td class="pv-price-summary-val">
                ${formatINR(pricing.cert32Amount)}
              </td>
            </tr>
            <tr>
              <td class="pv-price-summary-label">
                Extra for Packing &amp; Forwarding Charges
              </td>
              <td style="text-align: center; font-weight: bold;">
                ${pricing.pfPercent}%
              </td>
              <td class="pv-price-summary-val">
                ${formatINR(pricing.pfAmount)}
              </td>
            </tr>
            <tr>
              <td class="pv-price-summary-label" colspan="2">
                Third Party Inspection (TPIA) required then charges will be Extra to your account.
              </td>
              <td class="pv-price-summary-val">
                ${formatINR(pricing.tpiAmount)}
              </td>
            </tr>
            <tr style="background-color: #fafafa;">
              <td class="pv-price-summary-label" colspan="2">
                Grand Total (Inc. TPI, P&amp;F, Certi., etc.)
              </td>
              <td class="pv-price-summary-val" style="font-size: 9px;">
                ${formatINR(pricing.grandTotalBeforeGST)}
              </td>
            </tr>
            <tr>
              <td class="pv-price-summary-label" colspan="2">
                ${pricing.gstRate}% GST
              </td>
              <td class="pv-price-summary-val">
                ${formatINR(pricing.gstAmount)}
              </td>
            </tr>
            <tr style="background-color: #f0f0f0;">
              <td class="pv-price-summary-label" colspan="2" style="font-size: 9.5px; font-weight: 900;">
                Grand Total With GST
              </td>
              <td class="pv-price-summary-val" style="font-size: 10px; font-weight: 900; color: #000000;">
                ${formatINR(pricing.grandTotalWithGST)}
              </td>
            </tr>
          </tbody>
        </table>

      </div>

      ${renderOfficialFooter()}
    </div>
  `;
}

module.exports = { renderPricePart2 };

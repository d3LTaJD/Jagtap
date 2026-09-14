const { renderFormatOnlyFooter } = require('../components/Footer');
const { formatPdfValue, extractItemFieldValue, formatINR } = require('../dataFormatter');
const { calculateQuotationPricing } = require('../../../utils/quotationCalculator');

function renderPricePart2(quotation, chunkItems = null, chunkIndex = 0, totalChunks = 1, isLastChunk = true) {
  const pricing = calculateQuotationPricing(quotation);
  const items = chunkItems || pricing.items || [];

  const notice = formatPdfValue(
    quotation.pricingNoticeText || quotation.pricePartNotice,
    'We offer our Valves as below, considering Contract Review Check (Format No. R/5.1.3.5/2 Rev04).'
  );

  const totalCols = 10;
  const colIndices = Array.from({ length: totalCols }, (_, i) => i);

  const computedItems = colIndices.map(i => {
    const item = items[i];
    const globalSr = chunkIndex * 10 + i + 1;
    if (!item) {
      return {
        sr: '',
        hasItem: false,
        valveType: '',
        size: '',
        itemClass: '',
        qty: '',
        unitPrice: '',
        ndtText: '',
        spares: '',
        specTest: '',
        unitRate: '',
        totalRate: ''
      };
    }

    const rawVType = String(extractItemFieldValue(item, 'valve_type', 'Ball Valve')).toUpperCase();
    let valveType = 'Ball Valve';
    if (rawVType.includes('CHECK')) valveType = 'Check Valve';
    else if (rawVType.includes('GLOBE')) valveType = 'Globe Valve';
    else if (rawVType.includes('GATE')) valveType = 'Gate Valve';
    else if (rawVType.includes('BUTTERFLY')) valveType = 'Butterfly Valve';
    else if (rawVType.includes('PLUG')) valveType = 'Plug Valve';

    const rawSize = extractItemFieldValue(item, 'valve_size', '-');
    const size = rawSize ? String(rawSize).replace(/[^0-9]/g, '') : '-';

    const rawClass = extractItemFieldValue(item, 'valve_class', '-');
    const itemClass = rawClass ? String(rawClass).replace(/[^0-9]/g, '') : '-';

    const qty = (item.quantity !== undefined && item.quantity !== null && item.quantity !== '' && !isNaN(Number(item.quantity)) && Number(item.quantity) > 0) 
      ? Number(item.quantity) 
      : (item.quantity === null || item.quantity === undefined ? '-' : item.quantity);

    const unitPrice = Number(item.unitPrice) || 0;
    const unitRate = Number(item.unitRate) || (unitPrice * (1 - (Number(item.discountPercent) || 0) / 100));
    const totalRate = Number(item.lineTotalExclGST) || (unitRate * (Number(item.quantity) || 1));

    // NDT text resolution
    let ndtText = item.ndtRequirement || item.dynamicFields?.ndt_requirement || item.dynamicFields?.ndt_applicable;
    if (!ndtText || String(ndtText).trim() === '' || String(ndtText).trim() === '-') {
      const rt = String(extractItemFieldValue(item, 'valve_test_rt', '')).toLowerCase();
      const ut = String(extractItemFieldValue(item, 'valve_test_ut', '')).toLowerCase();
      const mpt = String(extractItemFieldValue(item, 'valve_test_mpt', '')).toLowerCase();
      const dpt = String(extractItemFieldValue(item, 'valve_test_dpt', '')).toLowerCase();

      const parts = [];
      if (rt.includes('yes') || rt.includes('applicable')) parts.push('RT');
      if (ut.includes('yes') || ut.includes('applicable')) parts.push('UT');
      if (mpt.includes('yes') || mpt.includes('applicable')) parts.push('MPT');
      if (dpt.includes('yes') || dpt.includes('applicable')) parts.push('DPT');

      if (parts.length > 0) {
        ndtText = `${parts.join(',')}\nApplicable`;
      } else {
        const sizeNum = Number(size) || 0;
        const classStr = String(itemClass).trim();
        if (classStr === '800' || (sizeNum > 0 && sizeNum <= 40)) {
          ndtText = 'UT,MPT\nApplicable';
        } else {
          ndtText = 'RT,MPT\nApplicable';
        }
      }
    } else {
      ndtText = String(ndtText).replace(/\s+Applicable/i, '\nApplicable');
    }

    return {
      sr: item.enquirySrNo || item.itemNo || globalSr,
      hasItem: true,
      valveType,
      size,
      itemClass,
      qty,
      unitPrice,
      ndtText,
      spares: '₹ 0',
      unitRate,
      totalRate
    };
  });

  const pageTitleSuffix = totalChunks > 1 ? ` (Page ${chunkIndex + 1} of ${totalChunks})` : '';

  return `
    <div class="pv-page" style="font-family: 'Times New Roman', Times, serif;">
      <div class="pv-page-content" style="padding: 20px 24px 10px 24px;">
        
        <!-- Centered Underlined Title exactly matching screenshot -->
        <div style="text-align: center; font-size: 13px; font-weight: bold; text-decoration: underline; margin-top: 10px; margin-bottom: 12px; letter-spacing: 0.5px;">
          PRICE PART – II${pageTitleSuffix}
        </div>

        <!-- Bold Bullet Statement -->
        <div style="font-size: 9.5px; font-weight: bold; margin-bottom: 12px; line-height: 1.4;">
          &bull; ${notice}
        </div>

        <!-- 11-Column Unified Price Schedule Table Matching Reference Image Exactly -->
        <table style="width: 100%; table-layout: fixed; border-collapse: collapse; font-family: 'Times New Roman', Times, serif; font-size: 8px; border: 1.5px solid #000000; word-wrap: break-word;">
          <colgroup>
            <col style="width: 165px;" />
            ${colIndices.map(() => `<col />`).join('')}
          </colgroup>
          <thead>
            <tr>
              <th style="border: 1px solid #000000; padding: 4px 2px; text-align: center; font-weight: bold; font-size: 8.5px;">
                Enquiry Sr. NO.
              </th>
              ${computedItems.map(c => `
                <th style="border: 1px solid #000000; padding: 4px 2px; text-align: center; font-weight: bold; font-size: 8.5px;">
                  ${c.sr}
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #000000; padding: 3px 4px; text-align: center; font-weight: bold;">Valve Type</td>
              ${computedItems.map(c => `<td style="border: 1px solid #000000; padding: 3px 2px; text-align: center;">${c.valveType}</td>`).join('')}
            </tr>
            <tr>
              <td style="border: 1px solid #000000; padding: 3px 4px; text-align: center; font-weight: bold;">Size in MM</td>
              ${computedItems.map(c => `<td style="border: 1px solid #000000; padding: 3px 2px; text-align: center;">${c.size}</td>`).join('')}
            </tr>
            <tr>
              <td style="border: 1px solid #000000; padding: 3px 4px; text-align: center; font-weight: bold;">Class</td>
              ${computedItems.map(c => `<td style="border: 1px solid #000000; padding: 3px 2px; text-align: center;">${c.itemClass}</td>`).join('')}
            </tr>
            <tr>
              <td style="border: 1px solid #000000; padding: 3px 4px; text-align: center; font-weight: bold;">Qunatity</td>
              ${computedItems.map(c => `<td style="border: 1px solid #000000; padding: 3px 2px; text-align: center;">${c.qty}</td>`).join('')}
            </tr>
            <tr>
              <td style="border: 1px solid #000000; padding: 3px 4px; text-align: center; font-weight: bold;">Unit Price</td>
              ${computedItems.map(c => `
                <td style="border: 1px solid #000000; padding: 3px 2px; text-align: center; font-weight: bold;">
                  ${c.hasItem ? (c.unitPrice > 0 ? formatINR(c.unitPrice) : '₹ 0') : ''}
                </td>
              `).join('')}
            </tr>
            <tr>
              <td style="border: 1px solid #000000; padding: 4px 6px; text-align: left; font-size: 7.2px; line-height: 1.15;">
                Any NDT Requirement<br/>
                (i.e. RT,UT,MPT) then<br/>
                <strong>charges will be Extra at<br/>
                actual to your account.</strong>
              </td>
              ${computedItems.map(c => `
                <td style="border: 1px solid #000000; padding: 3px 1px; text-align: center; vertical-align: middle; font-size: 7px; line-height: 1.15;">
                  ${c.ndtText ? c.ndtText.replace(/\n/g, '<br/>') : ''}
                </td>
              `).join('')}
            </tr>
            <tr>
              <td style="border: 1px solid #000000; padding: 4px 6px; text-align: left; font-size: 7.2px; line-height: 1.15;">
                If any Special Testing<br/>
                Requirement<br/>
                (i.e. Helium, Nitrogen,<br/>
                Vaccum, IGC, PMI, NACE,<br/>
                Paint) then <strong>charges will be<br/>
                Extra at actual to your<br/>
                account.</strong>
              </td>
              <td colspan="${totalCols}" style="border: 1px solid #000000; padding: 3px 2px; text-align: center; vertical-align: middle; font-size: 8.5px;">
                ${pricing.specialTestingAmount > 0 ? formatINR(pricing.specialTestingAmount) : '₹ 0'}
              </td>
            </tr>
            <tr>
              <td style="border: 1px solid #000000; padding: 4px 6px; text-align: left; font-size: 7.2px; line-height: 1.15;">
                Spares, Manday required<br/>
                then <strong>charges will be Extra<br/>
                at actual to your account.</strong>
              </td>
              ${computedItems.map(c => `
                <td style="border: 1px solid #000000; padding: 3px 2px; text-align: center; vertical-align: middle; font-size: 8px;">
                  ${c.hasItem ? c.spares : ''}
                </td>
              `).join('')}
            </tr>
            <tr>
              <td style="border: 1px solid #000000; padding: 3px 4px; text-align: center; font-weight: bold;">Unit Rate</td>
              ${computedItems.map(c => `
                <td style="border: 1px solid #000000; padding: 3px 2px; text-align: center;">
                  ${c.hasItem ? (c.unitRate > 0 ? formatINR(c.unitRate) : '₹ 0') : ''}
                </td>
              `).join('')}
            </tr>
            <tr>
              <td style="border: 1px solid #000000; padding: 3px 4px; text-align: center; font-weight: bold;">Total Rate</td>
              ${computedItems.map(c => `
                <td style="border: 1px solid #000000; padding: 3px 2px; text-align: center;">
                  ${c.hasItem ? (c.totalRate > 0 ? formatINR(c.totalRate) : '₹ 0') : ''}
                </td>
              `).join('')}
            </tr>

            ${isLastChunk ? `
            <!-- Summary Breakdown Rows Matching Reference Screenshot -->
            <tr>
              <td style="border: 1px solid #000000; padding: 3px 6px; text-align: left; font-size: 7.5px; line-height: 1.15;">
                Extra for 3.2<br/>
                Certificataton<br/>
                Charges.
              </td>
              <td style="border: 1px solid #000000; padding: 3px 2px; text-align: center; font-size: 8px;">
                ${pricing.cert32Percent}%
              </td>
              <td colspan="${totalCols - 1}" style="border: 1px solid #000000; padding: 3px 2px; text-align: center; font-size: 8.5px;">
                ${formatINR(pricing.cert32Amount)}
              </td>
            </tr>
            <tr>
              <td style="border: 1px solid #000000; padding: 3px 6px; text-align: left; font-size: 7.5px; line-height: 1.15;">
                Extra for Packing &amp;<br/>
                Forwarding Charges
              </td>
              <td style="border: 1px solid #000000; padding: 3px 2px; text-align: center; font-size: 8px;">
                ${pricing.pfPercent}%
              </td>
              <td colspan="${totalCols - 1}" style="border: 1px solid #000000; padding: 3px 2px; text-align: center; font-size: 8.5px;">
                ${formatINR(pricing.pfAmount)}
              </td>
            </tr>
            <tr>
              <td colspan="2" style="border: 1px solid #000000; padding: 3px 6px; text-align: left; font-size: 7.5px; line-height: 1.15;">
                Third Party Inspection<br/>
                (TPIA) required then<br/>
                charges will be Extra to<br/>
                your account.
              </td>
              <td colspan="${totalCols - 1}" style="border: 1px solid #000000; padding: 3px 2px; text-align: center; font-size: 8.5px;">
                ${formatINR(pricing.tpiAmount)}
              </td>
            </tr>
            <tr>
              <td colspan="2" style="border: 1px solid #000000; padding: 4px 6px; text-align: left; font-size: 8px; font-weight: bold; line-height: 1.15;">
                Grand Total (Inc. TPI, P&amp;F,<br/>
                Certi., etc.)
              </td>
              <td colspan="${totalCols - 1}" style="border: 1px solid #000000; padding: 4px 2px; text-align: center; font-weight: bold; font-size: 8.5px;">
                ${formatINR(pricing.grandTotalBeforeGST)}
              </td>
            </tr>
            <tr>
              <td colspan="2" style="border: 1px solid #000000; padding: 3px 6px; text-align: right; font-weight: bold; font-size: 8px;">
                ${pricing.gstRate}%GST
              </td>
              <td colspan="${totalCols - 1}" style="border: 1px solid #000000; padding: 3px 2px; text-align: center; font-weight: bold; font-size: 8.5px;">
                ${formatINR(pricing.gstAmount)}
              </td>
            </tr>
            <tr>
              <td colspan="2" style="border: 1px solid #000000; padding: 4px 6px; text-align: left; font-weight: bold; font-size: 8.5px;">
                Grand Total With GST
              </td>
              <td colspan="${totalCols - 1}" style="border: 1px solid #000000; padding: 4px 2px; text-align: center; font-weight: bold; font-size: 8.5px;">
                ${formatINR(pricing.grandTotalWithGST)}
              </td>
            </tr>
            ` : ''}
          </tbody>
        </table>

      </div>

      ${renderFormatOnlyFooter()}
    </div>
  `;
}

module.exports = { renderPricePart2 };

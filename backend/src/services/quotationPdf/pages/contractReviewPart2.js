const { renderChecklistFooter } = require('../components/ChecklistFooter');
const { getItemValue, formatDate } = require('./contractReviewPart1');
const { formatPdfValue } = require('../dataFormatter');

function renderContractReviewPart2(quotation) {
  const items = quotation.items || [];
  const offerNo = formatPdfValue(quotation.quotationId, 'PV/J/QTN/P-001/26-27');
  const offerDate = formatDate(quotation.createdAt || new Date());

  const totalCols = Math.max(items.length, 8);
  const colIndices = Array.from({ length: totalCols }, (_, i) => i);

  const renderRow = (sr, desc, fieldKey, defaultVal = '-') => {
    const cells = colIndices.map(i => {
      const item = items[i];
      if (!item) return `<td class="col-val"></td>`;
      const val = getItemValue(item, fieldKey, defaultVal);
      return `<td class="col-val">${val}</td>`;
    }).join('');

    return `
      <tr>
        <td class="col-sr">${sr}</td>
        <td class="col-desc">${desc}</td>
        ${cells}
      </tr>
    `;
  };

  return `
    <div class="pv-page pv-page-checklist">
      <div class="pv-page-content">
        
        <!-- Checklist Header -->
        <div class="pv-chk-header">
          <div class="pv-chk-company-name">Petro Valves Pvt.Ltd.</div>
          <div class="pv-chk-title">CONTRACT REVIEW CHECKLIST</div>
          <table class="pv-chk-meta-box">
            <tr>
              <td>NO</td>
              <td>${offerNo}</td>
            </tr>
            <tr>
              <td>DATE</td>
              <td>${offerDate}</td>
            </tr>
          </table>
        </div>

        <!-- Top Table (Continuation of Matrix & Annex K, L, M) -->
        <table class="pv-chk-table">
          <thead>
            <tr>
              <th colspan="2">Offer Sr. NO.</th>
              ${colIndices.map(i => `<th class="col-val">${i < items.length ? i + 1 : i + 1}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${renderRow('A', 'Valve Type', 'valve_type', 'VALVE')}
            ${renderRow('B', 'Size in MM', 'valve_size', '-')}
            ${renderRow('C', 'Class', 'valve_class', '-')}
            ${renderRow('D', 'Required API 6D Monogram', 'valve_api6d_monogram', 'No')}
            ${renderRow('E', 'Quality Specification Levels (QSL)<br/>QSL 2, 3, 3G, 4 & 4G', 'valve_qsl_level', 'No')}
            ${renderRow('ANNEX K', 'Purchase Specification Customization-Permissible Deviations to Specified Design and Manufacturing Requirments (N)', 'annex_k', 'No')}
            ${renderRow('ANNEX L', 'Specified Customization-Supplemental Options to Specified Design and Manufacturing Requirments (I)', 'annex_l', 'No')}
            ${renderRow('ANNEX M', 'Valves in Hydrogen (H2) Gas Service (I)', 'annex_m', 'No')}
          </tbody>
        </table>

        <!-- CONTRACT REVIEW - GENERAL SECTION -->
        <table class="pv-general-review-table">
          <thead>
            <tr>
              <td class="pv-general-review-title">CONTRACT REVIEW - GENERAL</td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>A. Any legal requirement applicable &ndash; Yes &#9632; / No</strong><br/>
                &nbsp;&nbsp;&nbsp;&nbsp;If Yes, which are <u>FACTORY ACT, INDIAN ELECTRICITY, AUTOMATIC ENERGY REGULATORY BOARD</u><br/>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;i) AERB for Steel material, Radioactive elements shall not be more than allowed Limit<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ii) Weight and measurement act<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;iii) Labor low for lifting of valve, lifting arrangement for valve weight more than 25 kg)<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;iv) AERB for RT enclosure and RT Gun, When RT applicable
              </td>
            </tr>
            <tr>
              <td>
                <strong>B. All requirements specified by the customer- Yes &#9632; / No</strong>
              </td>
            </tr>
            <tr>
              <td>
                <strong>C. Any additional requirement for valves, which are not stated by customer &amp; but necessary for valves: Yes &#9632; / No</strong><br/>
                &nbsp;&nbsp;&nbsp;&nbsp;IF, YES, As above given details.
              </td>
            </tr>
            <tr>
              <td>
                <strong>D. All requirement defined &amp; documented - Yes &#9632; / No</strong>
              </td>
            </tr>
            <tr>
              <td>
                <strong>E. Any differences from previously identified &amp; resolved - Yes &#9632; / No</strong>
              </td>
            </tr>
            <tr>
              <td>
                <strong>F. Petro Valves has the capability to meet the customer's requirement - Yes &#9632; / No</strong>
              </td>
            </tr>
            <tr>
              <td>
                <strong>G. Is there any customer specified / provided training required - Yes / No &#9632;</strong><br/>
                &nbsp;&nbsp;&nbsp;&nbsp;If yes, What type of Training and intimate HR/QC for co-ordination &hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;
              </td>
            </tr>
            <tr>
              <td>
                <strong>H. Is there any customer specified supplier to be used- Yes / No &#9632;</strong><br/>
                &nbsp;&nbsp;&nbsp;&nbsp;If yes, supplier names and intimate purchase for formal approval &hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;
              </td>
            </tr>
            <tr>
              <td>
                <strong>I. Is there any risk for execution, design &amp; supply of valves - Yes / No &#9632;</strong>
              </td>
            </tr>
            <tr>
              <td>
                <strong>K. Any different Between Inquiry and Offer - Yes / No &#9632;</strong>
              </td>
            </tr>
          </tbody>
        </table>

      </div>

      ${renderChecklistFooter('2 OF 2')}
    </div>
  `;
}

module.exports = { renderContractReviewPart2 };

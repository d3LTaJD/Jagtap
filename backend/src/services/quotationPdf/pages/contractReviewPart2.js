const { renderChecklistFooter } = require('../components/ChecklistFooter');
const { getItemValue, formatDate } = require('./contractReviewPart1');
const { formatPdfValue } = require('../dataFormatter');

function renderContractReviewPart2(quotation, chunkItems = null, chunkIndex = 0, totalChunks = 1) {
  const items = chunkItems || quotation.items || [];
  const offerNo = formatPdfValue(quotation.quotationId, 'PV/S/QTN/P-013/26-27');
  const offerDate = formatDate(quotation.createdAt || new Date());

  const totalCols = 10;
  const colIndices = Array.from({ length: totalCols }, (_, i) => i);

  const renderSectionHeader = (title) => `
    <tr class="section-hdr">
      <td colspan="${totalCols + 2}"><strong>${title}</strong></td>
    </tr>
  `;

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

  const footerText = totalChunks > 1 ? `${chunkIndex + 1} OF ${totalChunks} (SHEET 2)` : '2 OF 2';

  return `
    <div class="pv-page pv-page-checklist">
      <div class="pv-page-content">
        
        <!-- Checklist Header -->
        <div class="pv-chk-header">
          <div class="pv-chk-company-name">Petro Valves Pvt.Ltd.</div>
          <div class="pv-chk-company-sub">Kuha, Ahmedabad-382433</div>
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

        <!-- Top Table: Identification, Rows 66-67 & API 6D Annexures -->
        <table class="pv-chk-table">
          <thead>
            <tr>
              <th colspan="2">Offer Sr. NO.</th>
              ${colIndices.map(i => {
                const item = items[i];
                const globalSr = chunkIndex * 10 + i + 1;
                return `<th class="col-val">${item ? (item.enquirySrNo || item.itemNo || globalSr) : (i < items.length ? globalSr : '')}</th>`;
              }).join('')}
            </tr>
          </thead>
          <tbody>
            ${renderRow('A', 'Valve Type', 'valve_type', 'VALVE')}
            ${renderRow('B', 'Size in MM', 'valve_size', '-')}
            ${renderRow('C', 'Class', 'valve_class', '-')}
            ${renderRow('D', 'Required API 6D Monogram', 'valve_api6d_monogram', 'No')}
            ${renderRow('E', 'Quality Specification Levels (QSL)<br/>QSL 2, 3, 3G, 4 & 4G', 'valve_qsl_level', 'No')}

            ${renderRow('66', 'Location', 'valve_location', 'As per Client Requirement')}
            ${renderRow('67', 'Is there any special requirement', 'valve_other_special', 'No')}

            ${renderSectionHeader('API 6D ANNEXURE REQUIREMENTS')}
            <tr>
              <td class="col-sr">ANNEXURE</td>
              <td class="col-desc">NAME (INFORMAATIVE (I)/NORMATIVE (N))</td>
              <td colspan="${totalCols}" style="text-align:center; font-weight:bold;">APPLICABLE YES/NO</td>
            </tr>
            ${renderRow('ANNEX A', 'Repair or Remanufacturing of Valves (I)', 'annex_a', 'No')}
            ${renderRow('ANNEX B', 'Example of Valve Configurations (I)', 'annex_b', 'No')}
            ${renderRow('ANNEX C', 'Valve End-to-end and Face-to-face Dimensions (N)', 'annex_c', 'Yes')}
            ${renderRow('ANNEX D', 'Guidance for Travel Stops by Valve Type (I)', 'annex_d', 'Yes')}
            ${renderRow('ANNEX E', 'Isolation Valve Features (I)', 'annex_e', 'Yes')}
            ${renderRow('ANNEX F', 'Design Validation (I)', 'annex_f', 'No')}
            ${renderRow('ANNEX G', 'External Coating for End Connections (N)', 'annex_g', 'AS PER CLIENT REQUIREMENT / PO')}
            ${renderRow('ANNEX H', 'Heat-treating Equipment Qualification (N)', 'annex_h', 'Yes')}
            ${renderRow('ANNEX I', 'Quality Specification Level (QSL) and Supplimentery Testing (N)', 'annex_i', 'No')}
            ${renderRow('ANNEX J', 'Requirements for Extended Hydrostatic Shell Test Duration and Records Retention for Valves in Jurisdictional Pipeline Systems (I)', 'annex_j', 'No')}
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
                <strong>A. &nbsp; Any legal requirement applicable &ndash; Yes &#9632; / No</strong><br/>
                &nbsp;&nbsp;&nbsp;&nbsp;If Yes, which are <u>FACTORY ACT, INDIAN ELECTRICITY, AUTOMATIC ENERGY REGULATORY BOARD</u><br/>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;i) AERB for Steel material, Radioactive elements shall not be more than allowed Limit<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ii) Weight and measurement act<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;iii) Labor low for lifting of valve, lifting arrangement for valve weight more than 25 kg)<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;iv) AERB for RT enclosure and RT Gun, When RT applicable
              </td>
            </tr>
            <tr>
              <td>
                <strong>B. &nbsp; All requirements specified by the customer- Yes &#9632; / No</strong>
              </td>
            </tr>
            <tr>
              <td>
                <strong>C. &nbsp; Any additional requirement for valves, which are not stated by customer &amp; but necessary for valves: Yes &#9632; / No</strong><br/>
                &nbsp;&nbsp;&nbsp;&nbsp;IF, YES, As above given details.
              </td>
            </tr>
            <tr>
              <td>
                <strong>D. &nbsp; All requirement defined &amp; documented - Yes &#9632; / No</strong>
              </td>
            </tr>
            <tr>
              <td>
                <strong>E. &nbsp; Any differences from previously identified &amp; resolved - Yes &#9632; / No</strong>
              </td>
            </tr>
            <tr>
              <td>
                <strong>F. &nbsp; Petro Valves has the capability to meet the customer's requirement - Yes &#9632; / No</strong>
              </td>
            </tr>
            <tr>
              <td>
                <strong>G. &nbsp; Is there any customer specified / provided training required - Yes / No &#9632;</strong><br/>
                &nbsp;&nbsp;&nbsp;&nbsp;If yes, What type of Training and intimate HR/QC for co-ordination &hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;
              </td>
            </tr>
            <tr>
              <td>
                <strong>H. &nbsp; Is there any customer specified supplier to be used- Yes / No &#9632;</strong><br/>
                &nbsp;&nbsp;&nbsp;&nbsp;If yes, supplier names and intimate purchase for formal approval &hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;
              </td>
            </tr>
            <tr>
              <td>
                <strong>I. &nbsp; Is there any risk for execution, design &amp; supply of valves - Yes / No &#9632;</strong>
              </td>
            </tr>
            <tr>
              <td>
                <strong>K. &nbsp; Any different Between Inquiry and Offer - Yes / No &#9632;</strong>
              </td>
            </tr>
          </tbody>
        </table>

      </div>

      ${renderChecklistFooter(footerText)}
    </div>
  `;
}

module.exports = { renderContractReviewPart2 };

const { renderChecklistFooter } = require('../components/ChecklistFooter');
const { getItemValue, formatDate } = require('./contractReviewPart1');
const { formatPdfValue } = require('../dataFormatter');

function renderContractReviewPart2(quotation, chunkItems = null, chunkIndex = 0, totalChunks = 1) {
  const items = chunkItems || quotation.items || [];
  const offerNo = formatPdfValue(quotation.quotationId, 'PV/J/QTN/P-001/26-27');
  const offerDate = formatDate(quotation.createdAt || new Date());

  const totalCols = 8;
  const colIndices = Array.from({ length: totalCols }, (_, i) => i);

  const renderSectionHeader = (title) => `
    <tr class="section-hdr">
      <td colspan="${totalCols + 2}">${title}</td>
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

  const footerText = totalChunks > 1 ? `${chunkIndex + 1} OF ${totalChunks} (PART 2)` : '2 OF 2';

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

        <!-- Top Table (Continuation of Matrix: Items, Testing Continued, Final Testing, Other & Annexures) -->
        <table class="pv-chk-table">
          <thead>
            <tr>
              <th colspan="2">Offer Sr. NO.</th>
              ${colIndices.map(i => {
                const item = items[i];
                const globalSr = chunkIndex * 8 + i + 1;
                return `<th class="col-val">${item ? (item.enquirySrNo || item.itemNo || globalSr) : globalSr}</th>`;
              }).join('')}
            </tr>
          </thead>
          <tbody>
            ${renderRow('A', 'Valve Type', 'valve_type', 'VALVE')}
            ${renderRow('B', 'Size in MM', 'valve_size', '-')}
            ${renderRow('C', 'Class', 'valve_class', '-')}
            ${renderRow('D', 'Required API 6D Monogram', 'valve_api6d_monogram', 'No')}
            ${renderRow('E', 'Quality Specification Levels (QSL)<br/>QSL 2, 3, 3G, 4 & 4G', 'valve_qsl_level', 'No')}

            ${renderSectionHeader('RAW MATERIAL & SUPPLEMENTARY TESTING (CONTINUED)')}
            ${renderRow('45', 'Chemical Test', 'valve_chemical_test', 'Yes')}
            ${renderRow('46', 'Physical Test', 'valve_physical_test', 'Yes')}
            ${renderRow('47', 'Hardness Test Report On Pressure Containing Parts', 'valve_hardness_containing', 'Yes')}
            ${renderRow('48', 'Hardness Test Report On Pressure Controlling Parts', 'valve_hardness_controlling', 'Yes')}
            ${renderRow('49', 'Heat Treatment Chart', 'valve_heat_treatment_chart', 'No')}
            ${renderRow('50', 'Impact Hardness Test', 'valve_test_impact_hardness', '0° C')}
            ${renderRow('51', 'PQR & WPS', 'valve_pqr_wps', 'Yes')}
            ${renderRow('52', 'Solution Annealing', 'valve_solution_annealing', 'No')}
            ${renderRow('53', 'Seismic Testing', 'valve_test_seismic', 'No')}
            ${renderRow('54', 'Calibration Certificate', 'valve_calib_cert', 'Yes')}
            ${renderRow('55', 'IBR/CE Certification', 'valve_ibr_ce_cert', 'No')}
            ${renderRow('56', 'Design Validation as Per API 6D:25th Annexure\'s', 'valve_design_validation', 'No')}

            ${renderSectionHeader('FINAL TESTING')}
            ${renderRow('57', 'Hydro Shell Test (PSI) / Duration (Min.)', 'valve_hydro_shell', '3050 (02)')}
            ${renderRow('58', 'Hydro Seat Test (PSI) / Duration (Min.)', 'valve_hydro_seat', '2250 (02)')}
            ${renderRow('59', 'Air Seat Test (PSI) / Duration (Min.)', 'valve_air_seat', '100 (02)')}
            ${renderRow('60', 'DBB HYDRO FOR DBB VALVES<br/>(ONLY FOR TMBV VALVES) (PSI) / Duration (Min.)', 'valve_dbb_hydro', '-')}
            ${renderRow('61', 'Back Seat Test (PSI) / Duration (Min.)', 'valve_back_seat', '-')}
            ${renderRow('62', 'Antistatic Test', 'valve_antistatic_test', 'No')}

            ${renderSectionHeader('OTHER SPECIFICATION')}
            ${renderRow('63', 'Painting (DFT Micron)', 'valve_painting_dft', '300')}
            ${renderRow('64', 'Packing', 'valve_packing', 'Yes')}
            ${renderRow('65', 'Dispatch By', 'valve_dispatch_by', 'By Road')}
            ${renderRow('66', 'Location', 'valve_location', 'As per requirement')}
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
            ${renderRow('ANNEX E', 'Isolation Valve Features (I)', 'annex_e', 'No')}
            ${renderRow('ANNEX F', 'Design Validation (I)', 'annex_f', 'No')}
            ${renderRow('ANNEX G', 'External Coating for End Connections (N)', 'annex_g', 'As per requirement')}
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

      ${renderChecklistFooter(footerText)}
    </div>
  `;
}

module.exports = { renderContractReviewPart2 };

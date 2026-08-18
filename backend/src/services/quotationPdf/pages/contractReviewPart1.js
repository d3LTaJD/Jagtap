const { renderChecklistFooter } = require('../components/ChecklistFooter');
const { formatPdfValue, extractItemFieldValue } = require('../dataFormatter');

function formatDate(d) {
  if (!d) return new Date().toLocaleDateString('en-GB');
  const date = new Date(d);
  if (isNaN(date.getTime())) return formatPdfValue(d);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

function getItemValue(item, fieldKey, defaultVal = '-') {
  return extractItemFieldValue(item, fieldKey, defaultVal);
}

function renderContractReviewPart1(quotation) {
  const items = quotation.items || [];
  const offerNo = formatPdfValue(quotation.quotationId, 'PV/J/QTN/P-001/26-27');
  const offerDate = formatDate(quotation.createdAt || new Date());

  const totalCols = Math.max(items.length, 8);
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

        <!-- Checklist Matrix Table (Part 1) -->
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
            
            ${renderSectionHeader('DESIGN SPECIFICATION')}
            ${renderRow('1', 'Design Type', 'valve_design_type', '2 P/C LONG')}
            ${renderRow('2', 'Bore', 'valve_bore', '-')}
            ${renderRow('3', 'End Type', 'valve_end_connection', 'FLANGE')}
            ${renderRow('4', 'Operating of Valves', 'valve_operating', 'HAND WHEEL')}
            ${renderRow('5', 'Ball Type', 'valve_ball_type', '-')}
            ${renderRow('6', 'Direction', 'valve_direction', 'Bi Directional')}
            ${renderRow('7', 'Service (A) Liquid (B) Gas (C) Others', 'valve_service', 'GAS')}
            ${renderRow('8', 'Seat Type', 'valve_seat_type', 'Metal Seat')}
            ${renderRow('9', 'Valve Design Standard', 'valve_design_std', 'API 6D 25TH ED')}
            ${renderRow('10', 'Valve Testing Standard', 'valve_testing_std', 'API 6D 25TH ED')}
            ${renderRow('11', 'Minimum Design Operating Pressure', 'valve_min_design_press', '1750 PSI')}
            ${renderRow('12', 'Maximum Design Operating Pressure', 'valve_max_design_press', '1975 PSI')}
            ${renderRow('13', 'Minimium Design Temperature', 'valve_min_design_temp', '-29° C')}
            ${renderRow('14', 'Maximum Design Temperature', 'valve_max_design_temp', '121° C')}
            ${renderRow('15', 'Drain Connection Size in MM', 'valve_drain_conn_size', 'No')}
            ${renderRow('16', 'Vent Connection Size in MM', 'valve_vent_conn_size', 'No')}
            ${renderRow('17', 'Lifting Lug (25 Kg And Above)', 'valve_lifting_lug', 'No')}
            ${renderRow('18', 'Support Foot Required', 'valve_support_foot', 'No')}
            ${renderRow('19', 'Fire Safe Design', 'valve_fire_safe', 'No')}
            ${renderRow('20', 'Antistatic Device', 'valve_antistatic', 'No')}
            ${renderRow('21', 'Locking Device', 'valve_locking_device', 'No')}
            ${renderRow('22', 'Is Valve For Pigging:<br/>(A) Ball Valve (B) Gate Valve', 'valve_for_pigging', 'No')}
            ${renderRow('23', 'Pressure Relief Device', 'valve_prv', 'No')}
            ${renderRow('24', 'Cavity Relief Valve', 'valve_cavity_relief', 'No')}
            ${renderRow('25', 'By-Pass Connection', 'valve_bypass', 'No')}
            ${renderRow('26', 'Corrossion Alloance in MM', 'valve_corrosion_allowance', '1.5')}
            ${renderRow('27', 'Any Special Requirement', 'valve_special_req', 'No')}

            ${renderSectionHeader('MATERIAL OF CONSTRUCTION')}
            ${renderRow('28', 'Body/Side P/C/Bonnet/Trunnion', 'valve_moc_body', 'ASTM A216 Gr. WCB')}
            ${renderRow('29', 'Ball/Wedge/Disc', 'valve_moc_ball', '13% CR. STEEL')}
            ${renderRow('30', 'Stem/Hing', 'valve_moc_stem', '13% Cr. Steel')}
            ${renderRow('31', 'Seat Ring (Soft Seat)/Seat Holder', 'valve_moc_seat', '13% CR. STEEL')}
            ${renderRow('32', 'Stud & Nuts', 'valve_moc_stud_nuts', 'ASTM A193 Gr. B7 &<br/>ASTM A194 Gr. 2H')}
            ${renderRow('33', 'Extended Bonnet', 'valve_extended_bonnet', 'No')}

            ${renderSectionHeader('RAW MATERIAL & SUPPLEMENTARY REQUIRED TESTING DETAILS')}
            ${renderRow('34', 'Material Test Certificates<br/>(EN 10204 3.1 or EN 10204 3.2)', 'valve_mtc', 'EN 10204 3.2')}
            ${renderRow('35', 'RT', 'valve_test_rt', 'No')}
            ${renderRow('36', 'UT', 'valve_test_ut', 'Yes')}
            ${renderRow('37', 'DPT', 'valve_test_dpt', 'No')}
            ${renderRow('38', 'MPT', 'valve_test_mpt', 'No')}
            ${renderRow('39', 'NACE Requirement', 'valve_nace_req', 'No')}
            ${renderRow('40', 'Fugitive Emission Test/Helium Leak Test', 'valve_test_fugitive_emission', 'No')}
            ${renderRow('41', 'Cryogenics Test', 'valve_test_cryogenic', 'No')}
            ${renderRow('42', 'Demonstration of valve function under pressure and pipe loads and moments', 'valve_test_demo_function', 'No')}
            ${renderRow('43', 'IGC (Intergranular Corrosion Test)', 'valve_test_igc', 'No')}
            ${renderRow('44', 'PMI TEST', 'valve_test_pmi', 'No')}
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
          </tbody>
        </table>
      </div>

      ${renderChecklistFooter('1 OF 2')}
    </div>
  `;
}

module.exports = { renderContractReviewPart1, getItemValue, formatDate };

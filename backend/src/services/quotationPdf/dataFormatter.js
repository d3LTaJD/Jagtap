/**
 * Data Formatter & Normalizer for Petro Valves PDF Engine
 * Strictly prevents [object Object], undefined, null, NaN, and #DIV/0!
 */

/**
 * Safely and recursively unwraps AI extraction wrapper objects (e.g. { value: '50', confidence: 0.9 })
 */
function unwrapExtractedValue(value) {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    Object.prototype.hasOwnProperty.call(value, 'value') &&
    value.value !== undefined &&
    !value.unit
  ) {
    return unwrapExtractedValue(value.value);
  }
  return value;
}

/**
 * Centrally and safely formats any value into a human-readable display string
 * @param {*} value - The input value (string, number, boolean, object, array, etc.)
 * @param {string} fallback - The fallback string if empty or undefined (default: '-')
 * @returns {string} Safe display string
 */
function formatPdfValue(value, fallback = '-') {
  value = unwrapExtractedValue(value);

  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    if (isNaN(value)) return fallback;
    return String(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    const lower = trimmed.toLowerCase();
    if (['null', 'undefined', 'nan', '#div/0!', '[object object]'].includes(lower)) {
      return fallback;
    }
    return trimmed;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return fallback;
    const formattedItems = value
      .map(v => formatPdfValue(v, ''))
      .filter(v => v && v !== fallback && v !== '');
    return formattedItems.length > 0 ? formattedItems.join(', ') : fallback;
  }

  if (typeof value === 'object') {
    // If it's a Date object
    if (value instanceof Date) {
      if (isNaN(value.getTime())) return fallback;
      const day = String(value.getDate()).padStart(2, '0');
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const year = String(value.getFullYear()).slice(-2);
      return `${day}/${month}/${year}`;
    }

    // Check for common property wrapper schemas
    // Schema 1: { value: '...', unit: '...' }
    if (value.value !== undefined && value.value !== null) {
      const innerVal = formatPdfValue(value.value, '');
      if (value.unit && typeof value.unit === 'string' && value.unit.trim()) {
        return innerVal ? `${innerVal} ${value.unit.trim()}` : fallback;
      }
      return innerVal || fallback;
    }

    // Schema 2: { label: '...', value: '...' }
    if (value.label !== undefined && value.label !== null) {
      return formatPdfValue(value.label, fallback);
    }

    // Schema 3: { displayName: '...' }
    if (value.displayName !== undefined && value.displayName !== null) {
      return formatPdfValue(value.displayName, fallback);
    }

    // Schema 4: { name: '...' }
    if (value.name !== undefined && value.name !== null) {
      return formatPdfValue(value.name, fallback);
    }

    // Schema 5: { text: '...' }
    if (value.text !== undefined && value.text !== null) {
      return formatPdfValue(value.text, fallback);
    }

    // Schema 6: { formatted: '...' }
    if (value.formatted !== undefined && value.formatted !== null) {
      return formatPdfValue(value.formatted, fallback);
    }

    // Schema 7: { amount: '...' }
    if (value.amount !== undefined && value.amount !== null) {
      return formatPdfValue(value.amount, fallback);
    }

    // Schema 8: Inspect object values for primitives
    const keys = Object.keys(value);
    for (const k of keys) {
      const v = value[k];
      if (v !== null && v !== undefined && typeof v !== 'object') {
        const str = String(v).trim();
        if (str && !['null', 'undefined', 'nan', '[object object]'].includes(str.toLowerCase())) {
          return str;
        }
      }
    }

    // Final safety shield: NEVER return [object Object]
    return fallback;
  }

  return String(value) || fallback;
}

/**
 * Formats a currency amount in Indian Rupee format (₹ X,XX,XXX)
 */
function formatINR(val, showZero = true) {
  if (val === undefined || val === null) return showZero ? '₹ 0' : '-';
  let num = 0;
  if (typeof val === 'object') {
    const rawVal = val.amount ?? val.value ?? val.val ?? 0;
    num = Number(rawVal);
  } else {
    num = Number(val);
  }
  if (isNaN(num)) return showZero ? '₹ 0' : '-';
  if (num === 0 && !showZero) return '-';
  return '₹ ' + Math.round(num).toLocaleString('en-IN');
}

/**
 * Calculates test pressure & duration strings based on class rating & valve size
 * matching Petro Standards tables (PSI and duration in minutes).
 */
function getTestPressureAndDuration(cls, sz) {
  const clsNum = parseInt(cls, 10) || 150;
  const szNum = parseInt(sz, 10) || 50;

  const pressures = {
    150: { shell: 450, seat: 325 },
    300: { shell: 1125, seat: 825 },
    600: { shell: 2250, seat: 1650 },
    800: { shell: 3050, seat: 2250 },
    900: { shell: 3300, seat: 2450 },
    1500: { shell: 5500, seat: 4050 },
    2500: { shell: 9200, seat: 6700 }
  };

  const p = pressures[clsNum] || pressures[150];

  let shellDur = '02';
  let seatDur = '02';

  if (szNum >= 500) {
    shellDur = '30';
    seatDur = '10';
  } else if (szNum >= 300) {
    shellDur = '15';
    seatDur = '05';
  } else if (szNum >= 150) {
    shellDur = '05';
    seatDur = '05';
  }

  return {
    shell: `${p.shell} (${shellDur})`,
    seat: `${p.seat} (${seatDur})`,
    air: `100 (${seatDur})`
  };
}

/**
 * Extracts a displayable value from a quotation item by field key,
 * handling all alias variations and dynamic field schemas.
 */
function extractItemFieldValue(item, fieldKey, fallback = '-') {
  if (!item) return '';

  const itemObj = (item && typeof item.toObject === 'function') ? item.toObject() : item;
  const df = itemObj.dynamicFields || {};

  // Direct lookup in dynamicFields with safe formatting
  const findInDynamicFields = (keys) => {
    let dfObj = df;
    if (dfObj && typeof dfObj.toObject === 'function') {
      dfObj = dfObj.toObject();
    }
    for (const key of keys) {
      let rawVal = dfObj[key];
      if (rawVal === undefined && dfObj.get && typeof dfObj.get === 'function') {
        rawVal = dfObj.get(key);
      }
      rawVal = unwrapExtractedValue(rawVal);
      if (rawVal !== undefined && rawVal !== null) {
        const formatted = formatPdfValue(rawVal, '');
        if (formatted && formatted !== '') return formatted;
      }
    }
    return null;
  };

  switch (fieldKey) {
    case 'valve_type': {
      const fromDf = findInDynamicFields(['valve_type', 'valveType', 'productType', 'type']);
      const rawText = fromDf || itemObj.description || (itemObj.productCategory !== 'Valves' ? itemObj.productCategory : '') || '';
      if (rawText) {
        const d = String(rawText).toUpperCase();
        if (d.includes('BALL')) return 'BALL';
        if (d.includes('GLOBE')) return 'GLOBE';
        if (d.includes('CHECK') || d.includes('NRV')) return 'CHECK';
        if (d.includes('GATE')) return 'GATE';
        if (d.includes('BUTTERFLY')) return 'BUTTERFLY';
        if (d.includes('PLUG')) return 'PLUG';
      }
      if (fromDf) return String(fromDf).toUpperCase();
      return 'BALL';
    }

    case 'valve_size': {
      const fromDf = findInDynamicFields(['valve_size', 'size', 'size_mm', 'valveSize', 'sizeMm']);
      if (fromDf) {
        const m = String(fromDf).match(/(\d+)/);
        if (m) return m[1];
        return String(fromDf);
      }
      if (itemObj.size) return formatPdfValue(itemObj.size, fallback);
      if (itemObj.description) {
        const m = itemObj.description.match(/(\d+)\s*(?:MM|")/i) || itemObj.description.match(/(\d+)\s*IN/i) || itemObj.description.match(/DN\s*(\d+)/i);
        if (m) {
          const num = parseInt(m[1], 10);
          if ((itemObj.description.includes('IN') || itemObj.description.includes('"')) && num <= 36) {
            const inchMap = { 1: '25', 2: '50', 3: '80', 4: '100', 6: '150', 8: '200', 10: '250', 12: '300', 14: '350', 16: '400', 18: '450', 20: '500', 24: '600' };
            if (inchMap[num]) return inchMap[num];
          }
          return String(num);
        }
      }
      return fallback;
    }

    case 'valve_class': {
      const fromDf = findInDynamicFields(['valve_class', 'pressure_class', 'class', 'rating', 'valveClass']);
      if (fromDf) {
        const m = String(fromDf).match(/(\d+)/);
        if (m) return m[1];
        return String(fromDf);
      }
      if (itemObj.pressureClass) {
        const m = String(itemObj.pressureClass).match(/(\d+)/);
        if (m) return m[1];
        return String(itemObj.pressureClass);
      }
      if (itemObj.description) {
        const m = itemObj.description.match(/(?:#|CLASS|CL)\s*(\d+)/i) || itemObj.description.match(/(\d+)\s*#/);
        if (m) return m[1];
      }
      return fallback;
    }

    case 'valve_api6d_monogram': {
      const fromDf = findInDynamicFields(['valve_api6d_monogram', 'api6d_monogram', 'api_6d_monogram']);
      return fromDf ? (['yes', 'true', '1'].includes(fromDf.toLowerCase()) ? 'Yes' : 'No') : 'No';
    }

    case 'valve_qsl_level': {
      const fromDf = findInDynamicFields(['valve_qsl_level', 'qsl_level', 'qsl']);
      return fromDf ? (['no', 'none', 'false', '0'].includes(fromDf.toLowerCase()) ? 'No' : fromDf) : 'No';
    }

    case 'valve_design_type': {
      const fromDf = findInDynamicFields(['valve_design_type', 'design_type', 'designType']);
      if (fromDf) return fromDf;
      const vType = extractItemFieldValue(item, 'valve_type');
      if (vType === 'CHECK' || (itemObj.description && /CHECK|NRV/i.test(itemObj.description))) {
        const sz = parseInt(extractItemFieldValue(item, 'valve_size'), 10) || 50;
        return sz <= 40 ? 'Lift' : 'Swing';
      }
      return fallback;
    }

    case 'valve_bore': {
      return findInDynamicFields(['valve_bore', 'bore', 'bore_type']) || fallback;
    }

    case 'valve_end_connection': {
      return findInDynamicFields(['valve_end_connection', 'end_connection', 'end_type', 'endType']) || fallback;
    }

    case 'valve_operating': {
      return findInDynamicFields(['valve_operating', 'operating', 'operation_type', 'actuation']) || fallback;
    }

    case 'valve_ball_type': {
      return findInDynamicFields(['valve_ball_type', 'ball_type', 'disc_type']) || fallback;
    }

    case 'valve_direction': {
      const fromDf = findInDynamicFields(['valve_direction', 'direction', 'flow_direction']);
      if (fromDf) return fromDf;
      const vType = extractItemFieldValue(item, 'valve_type');
      if (vType === 'CHECK' || (itemObj.description && /CHECK|NRV/i.test(itemObj.description))) {
        return 'Uni Directional';
      }
      return fallback;
    }

    case 'valve_service': {
      return findInDynamicFields(['valve_service', 'service', 'service_medium', 'fluid_service']) || fallback;
    }

    case 'valve_seat_type': {
      return findInDynamicFields(['valve_seat_type', 'seat_type', 'seating']) || fallback;
    }

    case 'valve_design_std': {
      const fromDf = findInDynamicFields(['valve_design_std', 'design_std', 'design_standard']);
      if (fromDf) return fromDf;
      const vType = extractItemFieldValue(item, 'valve_type');
      if (vType === 'CHECK' || (itemObj.description && /CHECK|NRV/i.test(itemObj.description))) {
        const sz = parseInt(extractItemFieldValue(item, 'valve_size'), 10) || 50;
        return sz <= 40 ? 'BS1868' : 'API 6D 25TH ED';
      }
      return itemObj.applicableStandard || itemObj.standardCode || fallback;
    }

    case 'valve_testing_std': {
      const fromDf = findInDynamicFields(['valve_testing_std', 'testing_std', 'testing_standard']);
      if (fromDf) return fromDf;
      const vType = extractItemFieldValue(item, 'valve_type');
      if (vType === 'CHECK' || (itemObj.description && /CHECK|NRV/i.test(itemObj.description))) {
        const sz = parseInt(extractItemFieldValue(item, 'valve_size'), 10) || 50;
        return sz <= 40 ? 'API 598' : 'API 6D 25TH ED';
      }
      return fallback;
    }

    case 'valve_min_design_press': {
      return findInDynamicFields(['valve_min_design_press', 'min_design_press', 'min_pressure']) || fallback;
    }

    case 'valve_max_design_press': {
      return findInDynamicFields(['valve_max_design_press', 'max_design_press', 'max_pressure']) || fallback;
    }

    case 'valve_min_design_temp': {
      return findInDynamicFields(['valve_min_design_temp', 'min_design_temp', 'min_temperature']) || fallback;
    }

    case 'valve_max_design_temp': {
      return findInDynamicFields(['valve_max_design_temp', 'max_design_temp', 'max_temperature']) || fallback;
    }

    case 'valve_drain_conn_size': {
      return findInDynamicFields(['valve_drain_conn_size', 'drain_conn_size', 'drain_connection']) || 'No';
    }

    case 'valve_vent_conn_size': {
      return findInDynamicFields(['valve_vent_conn_size', 'vent_conn_size', 'vent_connection']) || 'No';
    }

    case 'valve_lifting_lug': {
      return findInDynamicFields(['valve_lifting_lug', 'lifting_lug']) || 'No';
    }

    case 'valve_support_foot': {
      return findInDynamicFields(['valve_support_foot', 'support_foot']) || 'No';
    }

    case 'valve_fire_safe': {
      return findInDynamicFields(['valve_fire_safe', 'fire_safe', 'fire_safe_design']) || 'No';
    }

    case 'valve_antistatic': {
      return findInDynamicFields(['valve_antistatic', 'antistatic', 'antistatic_device']) || 'No';
    }

    case 'valve_locking_device': {
      return findInDynamicFields(['valve_locking_device', 'locking_device']) || 'No';
    }

    case 'valve_for_pigging': {
      return findInDynamicFields(['valve_for_pigging', 'for_pigging', 'pigging']) || 'No';
    }

    case 'valve_prv': {
      return findInDynamicFields(['valve_prv', 'prv', 'pressure_relief_device']) || 'No';
    }

    case 'valve_cavity_relief': {
      return findInDynamicFields(['valve_cavity_relief', 'cavity_relief', 'cavity_relief_valve']) || 'No';
    }

    case 'valve_bypass': {
      return findInDynamicFields(['valve_bypass', 'bypass', 'bypass_connection']) || 'No';
    }

    case 'valve_corrosion_allowance': {
      return findInDynamicFields(['valve_corrosion_allowance', 'corrosion_allowance']) || '1.5';
    }

    case 'valve_special_req': {
      return findInDynamicFields(['valve_special_req', 'special_req', 'any_special_req']) || 'No';
    }

    // MOC Section
    case 'valve_moc_body': {
      return findInDynamicFields(['valve_moc_body', 'body_material', 'moc_body']) || item.materialGrade || fallback;
    }

    case 'valve_moc_ball': {
      return findInDynamicFields(['valve_moc_ball', 'ball_material', 'trim_material', 'moc_ball']) || fallback;
    }

    case 'valve_moc_stem': {
      return findInDynamicFields(['valve_moc_stem', 'stem_material', 'moc_stem']) || fallback;
    }

    case 'valve_moc_seat': {
      return findInDynamicFields(['valve_moc_seat', 'seat_material', 'moc_seat']) || fallback;
    }

    case 'valve_moc_stud_nuts': {
      return findInDynamicFields(['valve_moc_stud_nuts', 'stud_nuts_material', 'bolting_material']) || fallback;
    }

    case 'valve_extended_bonnet': {
      return findInDynamicFields(['valve_extended_bonnet', 'extended_bonnet']) || 'No';
    }

    // Testing Section
    case 'valve_mtc': {
      return findInDynamicFields(['valve_mtc', 'valve_test_mtc', 'mtc_type', 'cert_type']) || 'EN 10204 3.2';
    }

    case 'valve_test_rt': {
      return findInDynamicFields(['valve_test_rt', 'valve_rt', 'rt_test', 'rt']) || 'No';
    }

    case 'valve_test_ut': {
      return findInDynamicFields(['valve_test_ut', 'valve_ut', 'ut_test', 'ut']) || 'No';
    }

    case 'valve_test_dpt': {
      return findInDynamicFields(['valve_test_dpt', 'valve_dpt', 'dpt_test', 'dpt']) || 'No';
    }

    case 'valve_test_mpt': {
      return findInDynamicFields(['valve_test_mpt', 'valve_mpt', 'mpt_test', 'mpt']) || 'No';
    }

    case 'valve_nace_req': {
      return findInDynamicFields(['valve_nace_req', 'valve_nace', 'nace_requirement', 'nace']) || 'No';
    }

    case 'valve_test_fugitive_emission': {
      return findInDynamicFields(['valve_test_fugitive_emission', 'fugitive_emission_test', 'fugitive_emission']) || 'No';
    }

    case 'valve_test_cryogenic': {
      return findInDynamicFields(['valve_test_cryogenic', 'cryogenics_test', 'cryogenics']) || 'No';
    }

    case 'valve_test_demo_function': {
      return findInDynamicFields(['valve_test_demo_function', 'demo_function_test']) || 'No';
    }

    case 'valve_test_igc': {
      return findInDynamicFields(['valve_test_igc', 'igc_test', 'igc']) || 'No';
    }

    case 'valve_test_pmi': {
      return findInDynamicFields(['valve_test_pmi', 'pmi_test', 'pmi']) || 'No';
    }

    case 'valve_chemical_test': {
      return findInDynamicFields(['valve_chemical_test', 'chemical_test']) || 'Yes';
    }

    case 'valve_physical_test': {
      return findInDynamicFields(['valve_physical_test', 'physical_test']) || 'Yes';
    }

    case 'valve_hardness_containing': {
      return findInDynamicFields(['valve_hardness_containing', 'hardness_containing']) || 'Yes';
    }

    case 'valve_hardness_controlling': {
      return findInDynamicFields(['valve_hardness_controlling', 'hardness_controlling']) || 'Yes';
    }

    case 'valve_heat_treatment_chart': {
      return findInDynamicFields(['valve_heat_treatment_chart', 'heat_treatment_chart']) || 'No';
    }

    case 'valve_test_impact_hardness': {
      return findInDynamicFields(['valve_test_impact_hardness', 'impact_hardness_test']) || '0° C';
    }

    case 'valve_pqr_wps': {
      return findInDynamicFields(['valve_pqr_wps', 'pqr_wps']) || 'Yes';
    }

    case 'valve_solution_annealing': {
      return findInDynamicFields(['valve_solution_annealing', 'solution_annealing']) || 'No';
    }

    case 'valve_test_seismic': {
      return findInDynamicFields(['valve_test_seismic', 'seismic_test']) || 'No';
    }

    case 'valve_calib_cert': {
      return findInDynamicFields(['valve_calib_cert', 'calibration_certificate']) || 'Yes';
    }

    case 'valve_ibr_ce_cert': {
      return findInDynamicFields(['valve_ibr_ce_cert', 'ibr_ce_cert', 'ibr_certification']) || 'No';
    }

    case 'valve_design_validation': {
      return findInDynamicFields(['valve_design_validation', 'design_validation']) || 'No';
    }

    // Final Testing
    case 'valve_hydro_shell': {
      const fromDf = findInDynamicFields(['valve_hydro_shell', 'hydro_shell_test', 'hydro_shell']);
      if (fromDf) return fromDf;
      const cls = extractItemFieldValue(item, 'valve_class');
      const sz = extractItemFieldValue(item, 'valve_size');
      return getTestPressureAndDuration(cls, sz).shell;
    }

    case 'valve_hydro_seat': {
      const fromDf = findInDynamicFields(['valve_hydro_seat', 'hydro_seat_test', 'hydro_seat']);
      if (fromDf) return fromDf;
      const cls = extractItemFieldValue(item, 'valve_class');
      const sz = extractItemFieldValue(item, 'valve_size');
      return getTestPressureAndDuration(cls, sz).seat;
    }

    case 'valve_air_seat': {
      const fromDf = findInDynamicFields(['valve_air_seat', 'air_seat_test', 'air_seat']);
      if (fromDf) return fromDf;
      const cls = extractItemFieldValue(item, 'valve_class');
      const sz = extractItemFieldValue(item, 'valve_size');
      return getTestPressureAndDuration(cls, sz).air;
    }

    case 'valve_dbb_hydro': {
      const fromDf = findInDynamicFields(['valve_dbb_hydro', 'dbb_hydro_test']);
      if (fromDf) return fromDf;
      const vType = extractItemFieldValue(item, 'valve_type');
      const dType = String(extractItemFieldValue(item, 'valve_design_type')).toUpperCase();
      const desc = String(itemObj.description || '').toUpperCase();
      const isTmbv = dType.includes('TRUNNION') || dType.includes('TMBV') || desc.includes('TRUNNION') || desc.includes('TMBV');
      if (vType === 'BALL' && isTmbv) {
        const cls = extractItemFieldValue(item, 'valve_class');
        const sz = extractItemFieldValue(item, 'valve_size');
        return getTestPressureAndDuration(cls, sz).seat;
      }
      return '-';
    }

    case 'valve_back_seat': {
      return findInDynamicFields(['valve_back_seat', 'back_seat_test']) || '-';
    }

    case 'valve_antistatic_test': {
      const fromDf = findInDynamicFields(['valve_antistatic_test', 'antistatic_test']);
      if (fromDf) return fromDf;
      const vType = extractItemFieldValue(item, 'valve_type');
      if (vType === 'BALL' || (itemObj.description && /BALL/i.test(itemObj.description))) {
        return 'Yes';
      }
      if (vType === 'CHECK' || (itemObj.description && /CHECK|NRV/i.test(itemObj.description))) {
        return '-';
      }
      return 'No';
    }

    // Other Specification
    case 'valve_painting_dft': {
      return findInDynamicFields(['valve_painting_dft', 'painting_dft', 'dft_micron', 'painting']) || '120';
    }

    case 'valve_packing': {
      return findInDynamicFields(['valve_packing', 'packing_type', 'packing']) || 'Yes';
    }

    case 'valve_dispatch_by': {
      return findInDynamicFields(['valve_dispatch_by', 'dispatch_by', 'dispatch_mode']) || 'By Road';
    }

    case 'valve_location': {
      return findInDynamicFields(['valve_location', 'delivery_location', 'location']) || 'As per requirement';
    }

    case 'valve_other_special': {
      return findInDynamicFields(['valve_other_special', 'other_special_req']) || 'No';
    }

    // Annexures
    case 'annex_a': return findInDynamicFields(['annex_a', 'valve_annex_a']) || 'No';
    case 'annex_b': return findInDynamicFields(['annex_b', 'valve_annex_b']) || 'No';
    case 'annex_c': return findInDynamicFields(['annex_c', 'valve_annex_c']) || 'Yes';
    case 'annex_d': return findInDynamicFields(['annex_d', 'valve_annex_d']) || 'Yes';
    case 'annex_e': {
      const fromDf = findInDynamicFields(['annex_e', 'valve_annex_e']);
      if (fromDf) return fromDf;
      const vType = extractItemFieldValue(item, 'valve_type');
      const dType = String(extractItemFieldValue(item, 'valve_design_type')).toUpperCase();
      const desc = String(itemObj.description || '').toUpperCase();
      const isTmbv = dType.includes('TRUNNION') || dType.includes('TMBV') || desc.includes('TRUNNION') || desc.includes('TMBV');
      if (vType === 'BALL' && isTmbv) {
        return 'Yes';
      }
      return 'No';
    }
    case 'annex_f': return findInDynamicFields(['annex_f', 'valve_annex_f']) || 'No';
    case 'annex_g': return findInDynamicFields(['annex_g', 'valve_annex_g']) || 'Yes';
    case 'annex_h': return findInDynamicFields(['annex_h', 'valve_annex_h']) || 'Yes';
    case 'annex_i': return findInDynamicFields(['annex_i', 'valve_annex_i']) || 'No';
    case 'annex_j': return findInDynamicFields(['annex_j', 'valve_annex_j']) || 'No';
    case 'annex_k': return findInDynamicFields(['annex_k', 'valve_annex_k']) || 'No';
    case 'annex_l': return findInDynamicFields(['annex_l', 'valve_annex_l']) || 'No';
    case 'annex_m': return findInDynamicFields(['annex_m', 'valve_annex_m']) || 'No';

    default: {
      if (df[fieldKey] !== undefined && df[fieldKey] !== null) {
        return formatPdfValue(df[fieldKey], fallback);
      }
      if (item[fieldKey] !== undefined && item[fieldKey] !== null) {
        return formatPdfValue(item[fieldKey], fallback);
      }
      return fallback;
    }
  }
}

module.exports = {
  formatPdfValue,
  formatINR,
  extractItemFieldValue
};

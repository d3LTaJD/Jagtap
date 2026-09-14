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
  let df = itemObj.dynamicFields || {};
  if (df && typeof df.toObject === 'function') df = df.toObject();
  let norm = itemObj.normalizedSpecifications || {};
  if (norm && typeof norm.toObject === 'function') norm = norm.toObject();
  const desc = itemObj.description || '';

  // 1. Valve Type
  const vTypeRaw = String(df.valve_type || itemObj.valveType || desc || itemObj.productCategory || 'Ball Valve').toUpperCase();
  let vType = 'BALL';
  if (vTypeRaw.includes('CHECK') || vTypeRaw.includes('NRV')) vType = 'CHECK';
  else if (vTypeRaw.includes('GLOBE')) vType = 'GLOBE';
  else if (vTypeRaw.includes('GATE')) vType = 'GATE';
  else if (vTypeRaw.includes('BUTTERFLY')) vType = 'BUTTERFLY';
  else if (vTypeRaw.includes('PLUG')) vType = 'PLUG';

  // 2. Valve Size (in MM)
  let sz = parseInt(String(df.valve_size || df.size || itemObj.size || 50).replace(/[^0-9]/g, ''), 10) || 50;
  const mInch = desc.match(/(\d+)\s*(?:"|IN|''|inch)/i);
  if (mInch) {
    const inchMap = { 1: 25, 2: 50, 3: 80, 4: 100, 6: 150, 8: 200, 10: 250, 12: 300, 14: 350, 16: 400, 18: 450, 20: 500, 24: 600 };
    if (inchMap[mInch[1]]) sz = inchMap[mInch[1]];
  }

  // 3. Pressure Class Rating
  let cl = parseInt(String(df.valve_class || df.class || itemObj.pressureClass || 150).replace(/[^0-9]/g, ''), 10) || 150;
  if (/(?:#|CLASS|CL)\s*600|600\s*#/i.test(desc)) cl = 600;
  else if (/(?:#|CLASS|CL)\s*300|300\s*#/i.test(desc)) cl = 300;
  else if (/(?:#|CLASS|CL)\s*150|150\s*#/i.test(desc)) cl = 150;
  else if (/(?:#|CLASS|CL)\s*800|800\s*#/i.test(desc)) cl = 800;
  else if (/(?:#|CLASS|CL)\s*900|900\s*#/i.test(desc)) cl = 900;
  else if (/(?:#|CLASS|CL)\s*1500|1500\s*#/i.test(desc)) cl = 1500;
  else if (/(?:#|CLASS|CL)\s*2500|2500\s*#/i.test(desc)) cl = 2500;

  // 4. Trunnion vs Floating
  let isTmbv = false;
  if (vType === 'BALL') {
    if (cl === 150 || cl === 300) isTmbv = sz >= 200;
    else if (cl === 600) isTmbv = sz >= 50;
    else if (cl === 800) isTmbv = sz >= 65;
    else if (cl >= 900) isTmbv = true;
  }

  // Map of field key aliases connecting PDF templates and Frontend UI
  const keyAliases = {
    valve_type: ['valve_type', 'valveType', 'productType'],
    valve_size: ['valve_size', 'size', 'size_mm', 'valveSize'],
    valve_class: ['valve_class', 'pressure_class', 'class', 'rating'],
    valve_api6d_monogram: ['valve_api6d_monogram', 'api6d_monogram'],
    valve_qsl_level: ['valve_qsl_level', 'qsl_level', 'qsl'],
    valve_design_type: ['valve_design_type', 'design_type', 'designType'],
    valve_bore: ['valve_bore', 'bore', 'bore_type'],
    valve_end_connection: ['valve_end_connection', 'end_connection', 'end_type'],
    valve_operating: ['valve_operating', 'operating', 'operation_type', 'actuation'],
    valve_ball_type: ['valve_ball_type', 'ball_type', 'disc_type'],
    valve_direction: ['valve_direction', 'direction', 'flow_direction'],
    valve_service: ['valve_service', 'service', 'service_medium'],
    valve_seat_type: ['valve_seat_type', 'seat_type', 'seating'],
    valve_design_std: ['valve_design_std', 'design_std', 'design_standard'],
    valve_testing_std: ['valve_testing_std', 'testing_std', 'testing_standard'],
    valve_min_design_press: ['valve_min_design_pressure', 'valve_min_design_press', 'min_design_press', 'min_pressure'],
    valve_min_design_pressure: ['valve_min_design_pressure', 'valve_min_design_press', 'min_design_press', 'min_pressure'],
    valve_max_design_press: ['valve_max_design_pressure', 'valve_max_design_press', 'max_design_press', 'max_pressure'],
    valve_max_design_pressure: ['valve_max_design_pressure', 'valve_max_design_press', 'max_design_press', 'max_pressure'],
    valve_min_design_temp: ['valve_min_design_temp', 'min_design_temp', 'min_temperature'],
    valve_max_design_temp: ['valve_max_design_temp', 'max_design_temp', 'max_temperature'],
    valve_drain_conn_size: ['valve_drain_size', 'valve_drain_conn_size', 'drain_conn_size', 'drain_size'],
    valve_drain_size: ['valve_drain_size', 'valve_drain_conn_size', 'drain_conn_size', 'drain_size'],
    valve_vent_conn_size: ['valve_vent_size', 'valve_vent_conn_size', 'vent_conn_size', 'vent_size'],
    valve_vent_size: ['valve_vent_size', 'valve_vent_conn_size', 'vent_conn_size', 'vent_size'],
    valve_lifting_lug: ['valve_lifting_lug', 'lifting_lug'],
    valve_support_foot: ['valve_support_foot', 'support_foot'],
    valve_fire_safe: ['valve_fire_safe', 'fire_safe', 'fire_safe_design'],
    valve_antistatic: ['valve_antistatic', 'antistatic', 'antistatic_device'],
    valve_locking_device: ['valve_locking', 'valve_locking_device', 'locking_device'],
    valve_locking: ['valve_locking', 'valve_locking_device', 'locking_device'],
    valve_for_pigging: ['valve_pigging', 'valve_for_pigging', 'pigging', 'for_pigging'],
    valve_pigging: ['valve_pigging', 'valve_for_pigging', 'pigging', 'for_pigging'],
    valve_prv: ['valve_pressure_relief', 'valve_prv', 'pressure_relief', 'prv'],
    valve_pressure_relief: ['valve_pressure_relief', 'valve_prv', 'pressure_relief', 'prv'],
    valve_cavity_relief: ['valve_cavity_relief', 'cavity_relief', 'cavity_relief_valve'],
    valve_bypass: ['valve_bypass', 'bypass', 'bypass_connection'],
    valve_corrosion_allowance: ['valve_corrosion_allowance', 'corrosion_allowance'],
    valve_special_req: ['valve_special_req', 'special_req', 'any_special_req'],
    // MOC Aliases
    valve_moc_body: ['valve_body_moc', 'valve_moc_body', 'body_material', 'moc_body'],
    valve_body_moc: ['valve_body_moc', 'valve_moc_body', 'body_material', 'moc_body'],
    valve_moc_ball: ['valve_ball_moc', 'trim_moc'], // Ignore raw OCR bug valve_moc_ball
    valve_ball_moc: ['valve_ball_moc', 'trim_moc'],
    valve_moc_stem: ['valve_stem_moc', 'stem_material'],
    valve_stem_moc: ['valve_stem_moc', 'stem_material'],
    valve_moc_seat: ['valve_seat_ring_moc', 'seat_material'],
    valve_seat_ring_moc: ['valve_seat_ring_moc', 'seat_material'],
    valve_moc_stud_nuts: ['valve_fasteners_moc', 'stud_nuts_material', 'fasteners_moc'],
    valve_fasteners_moc: ['valve_fasteners_moc', 'stud_nuts_material', 'fasteners_moc'],
    valve_extended_bonnet: ['valve_extended_bonnet', 'extended_bonnet'],
    // Testing Aliases
    valve_mtc: ['test_mtc', 'valve_mtc', 'mtc_type'],
    test_mtc: ['test_mtc', 'valve_mtc', 'mtc_type'],
    valve_test_rt: ['test_rt', 'valve_test_rt', 'rt_test', 'rt'],
    test_rt: ['test_rt', 'valve_test_rt', 'rt_test', 'rt'],
    valve_test_ut: ['test_ut', 'valve_test_ut', 'ut_test', 'ut'],
    test_ut: ['test_ut', 'valve_test_ut', 'ut_test', 'ut'],
    valve_test_dpt: ['test_dpt', 'valve_test_dpt', 'dpt_test', 'dpt'],
    test_dpt: ['test_dpt', 'valve_test_dpt', 'dpt_test', 'dpt'],
    valve_test_mpt: ['test_mpt', 'valve_test_mpt', 'mpt_test', 'mpt'],
    test_mpt: ['test_mpt', 'valve_test_mpt', 'mpt_test', 'mpt'],
    valve_nace_req: ['test_nace', 'valve_nace_req', 'nace_requirement', 'nace'],
    test_nace: ['test_nace', 'valve_nace_req', 'nace_requirement', 'nace'],
    valve_test_fugitive_emission: ['test_fugitive_emission', 'valve_test_fugitive_emission', 'fugitive_emission'],
    test_fugitive_emission: ['test_fugitive_emission', 'valve_test_fugitive_emission', 'fugitive_emission'],
    valve_test_cryogenic: ['test_cryogenic', 'valve_test_cryogenic', 'cryogenics'],
    test_cryogenic: ['test_cryogenic', 'valve_test_cryogenic', 'cryogenics'],
    valve_test_demo_function: ['test_load_moments', 'valve_test_demo_function', 'demo_function_test'],
    test_load_moments: ['test_load_moments', 'valve_test_demo_function', 'demo_function_test'],
    valve_test_igc: ['test_igc', 'valve_test_igc', 'igc_test', 'igc'],
    test_igc: ['test_igc', 'valve_test_igc', 'igc_test', 'igc'],
    valve_test_pmi: ['test_pmi', 'valve_test_pmi', 'pmi_test', 'pmi'],
    test_pmi: ['test_pmi', 'valve_test_pmi', 'pmi_test', 'pmi'],
    valve_chemical_test: ['test_chemical', 'valve_chemical_test', 'chemical_test'],
    test_chemical: ['test_chemical', 'valve_chemical_test', 'chemical_test'],
    valve_physical_test: ['test_physical', 'valve_physical_test', 'physical_test'],
    test_physical: ['test_physical', 'valve_physical_test', 'physical_test'],
    valve_hardness_containing: ['test_hardness_pressure_containing', 'valve_hardness_containing'],
    test_hardness_pressure_containing: ['test_hardness_pressure_containing', 'valve_hardness_containing'],
    valve_hardness_controlling: ['test_hardness_pressure_controlling', 'valve_hardness_controlling'],
    test_hardness_pressure_controlling: ['test_hardness_pressure_controlling', 'valve_hardness_controlling'],
    valve_heat_treatment_chart: ['test_heat_treatment_chart', 'valve_heat_treatment_chart'],
    test_heat_treatment_chart: ['test_heat_treatment_chart', 'valve_heat_treatment_chart'],
    valve_test_impact_hardness: ['test_impact', 'valve_test_impact_hardness', 'impact_test'],
    test_impact: ['test_impact', 'valve_test_impact_hardness', 'impact_test'],
    valve_pqr_wps: ['test_pqr_wps', 'valve_pqr_wps', 'pqr_wps'],
    test_pqr_wps: ['test_pqr_wps', 'valve_pqr_wps', 'pqr_wps'],
    valve_solution_annealing: ['test_solution_annealing', 'valve_solution_annealing', 'solution_annealing'],
    test_solution_annealing: ['test_solution_annealing', 'valve_solution_annealing', 'solution_annealing'],
    valve_test_seismic: ['test_seismic', 'valve_test_seismic', 'seismic_test'],
    test_seismic: ['test_seismic', 'valve_test_seismic', 'seismic_test'],
    valve_calib_cert: ['test_calibration', 'valve_calib_cert', 'calibration_certificate'],
    test_calibration: ['test_calibration', 'valve_calib_cert', 'calibration_certificate'],
    valve_ibr_ce_cert: ['test_ibr_ce', 'valve_ibr_ce_cert', 'ibr_ce_cert'],
    test_ibr_ce: ['test_ibr_ce', 'valve_ibr_ce_cert', 'ibr_ce_cert'],
    valve_design_validation: ['test_api6d_validation', 'valve_design_validation', 'design_validation'],
    test_api6d_validation: ['test_api6d_validation', 'valve_design_validation', 'design_validation'],
    // Final Testing
    valve_hydro_shell: ['test_hydro_shell', 'valve_hydro_shell', 'hydro_shell_test'],
    test_hydro_shell: ['test_hydro_shell', 'valve_hydro_shell', 'hydro_shell_test'],
    valve_hydro_seat: ['test_hydro_seat', 'valve_hydro_seat', 'hydro_seat_test'],
    test_hydro_seat: ['test_hydro_seat', 'valve_hydro_seat', 'hydro_seat_test'],
    valve_air_seat: ['test_air_seat', 'valve_air_seat', 'air_seat_test'],
    test_air_seat: ['test_air_seat', 'valve_air_seat', 'air_seat_test'],
    valve_dbb_hydro: ['test_dbb_hydro', 'valve_dbb_hydro', 'dbb_hydro_test'],
    test_dbb_hydro: ['test_dbb_hydro', 'valve_dbb_hydro', 'dbb_hydro_test'],
    valve_back_seat: ['test_back_seat', 'valve_back_seat', 'back_seat_test'],
    test_back_seat: ['test_back_seat', 'valve_back_seat', 'back_seat_test'],
    valve_antistatic_test: ['test_antistatic_test', 'valve_antistatic_test', 'antistatic_test'],
    test_antistatic_test: ['test_antistatic_test', 'valve_antistatic_test', 'antistatic_test'],
    // Other Specifications
    valve_painting_dft: ['spec_painting', 'valve_painting_dft', 'painting_dft'],
    spec_painting: ['spec_painting', 'valve_painting_dft', 'painting_dft'],
    valve_packing: ['spec_packing', 'valve_packing', 'packing'],
    spec_packing: ['spec_packing', 'valve_packing', 'packing'],
    valve_dispatch_by: ['spec_dispatch', 'valve_dispatch_by', 'dispatch_by'],
    spec_dispatch: ['spec_dispatch', 'valve_dispatch_by', 'dispatch_by'],
    valve_location: ['spec_location', 'valve_location', 'location'],
    spec_location: ['spec_location', 'valve_location', 'location'],
    valve_other_special: ['spec_special_clause', 'valve_other_special', 'special_requirement'],
    spec_special_clause: ['spec_special_clause', 'valve_other_special', 'special_requirement']
  };

  const lookupKeys = keyAliases[fieldKey] || [fieldKey];
  let raw = undefined;
  for (const k of lookupKeys) {
    if (df[k] !== undefined && df[k] !== null && df[k] !== '') {
      raw = df[k];
      break;
    }
    if (norm[k] !== undefined && norm[k] !== null && norm[k] !== '') {
      raw = norm[k];
      break;
    }
  }

  // Filter out invalid raw OCR leaks / mismatched defaults (matching ContractReviewMatrix.jsx)
  const isInvalidLeak = 
    (fieldKey === 'valve_extended_bonnet' && raw === 'Flanged RF') ||
    ((fieldKey.includes('drain') || fieldKey.includes('vent')) && raw && !['15 mm', '25 mm', 'No', 'NO'].includes(String(raw).trim())) ||
    (['valve_moc_ball', 'valve_ball_moc', 'valve_moc_stem', 'valve_stem_moc', 'valve_moc_seat', 'valve_seat_ring_moc', 'valve_moc_stud_nuts', 'valve_fasteners_moc'].includes(fieldKey) && ['ASTM A216 WCB', 'ASTM A216 Gr. WCB'].includes(String(raw).trim())) ||
    (vType === 'CHECK' && (
      (fieldKey.includes('drain') && ['15 mm', '25 mm'].includes(raw)) ||
      (fieldKey.includes('vent') && ['15 mm', '25 mm'].includes(raw)) ||
      (fieldKey.includes('bore') && ['Full Bore', 'Reduced Bore'].includes(raw)) ||
      (fieldKey.includes('ball_type') && ['Floating', 'TMBV'].includes(raw)) ||
      (fieldKey.includes('operating') && ['Handle', 'Gear Box'].includes(raw)) ||
      (fieldKey.includes('antistatic') && raw === 'Yes') ||
      (fieldKey.includes('direction') && raw === 'Bi-Directional') ||
      (fieldKey.includes('solution_annealing') && raw === 'Yes') ||
      (fieldKey.includes('air_seat') && (raw === '100 PSI' || String(raw).includes('100'))) ||
      (fieldKey.includes('dbb') && raw !== '-') ||
      ((fieldKey.startsWith('annex_') || fieldKey.startsWith('api_6d_annex_')) && raw === 'Yes')
    )) ||
    (vType === 'GLOBE' && (
      (fieldKey.includes('bore') && ['Full Bore', 'Reduced Bore'].includes(raw)) ||
      (fieldKey.includes('ball_type') && ['Floating', 'TMBV', '-'].includes(raw)) ||
      (fieldKey.includes('operating') && (raw === 'Handle' || raw === '-')) ||
      (fieldKey.includes('direction') && raw === 'Bi-Directional') ||
      (fieldKey.includes('fire_safe') && ['API 607', 'API 6FA'].includes(raw)) ||
      (fieldKey.includes('antistatic') && raw !== '-') ||
      (fieldKey.includes('dbb') && raw !== '-') ||
      (fieldKey.includes('back_seat') && raw === '-') ||
      ((fieldKey.startsWith('annex_') || fieldKey.startsWith('api_6d_annex_')) && raw === 'Yes')
    ));

  if (raw !== undefined && raw !== null && raw !== '' && raw !== 'Ball Valve' && raw !== 'Valves' && !isInvalidLeak) {
    if (typeof raw === 'object') return raw.value || raw.normalizedValue || raw.rawValue || fallback;
    const strVal = String(raw).trim();
    // Normalize booleans
    if (strVal.toLowerCase() === 'true') return 'Yes';
    if (strVal.toLowerCase() === 'false') return 'No';

    // Format Hydro Testing into Standard "${pressure} (${duration})"
    if (['valve_hydro_shell', 'test_hydro_shell', 'valve_hydro_seat', 'test_hydro_seat', 'valve_air_seat', 'test_air_seat'].includes(fieldKey)) {
      const pMatch = strVal.match(/(\d+)/);
      if (pMatch) {
        let dur = '02';
        if (fieldKey.includes('shell')) {
          if (sz >= 500) dur = '30';
          else if (sz >= 300) dur = '15';
          else if (sz >= 150) dur = '05';
        } else {
          if (sz >= 500) dur = '10';
          else if (sz >= 150) dur = '05';
        }
        return `${pMatch[1]} (${dur})`;
      }
    }
    return strVal;
  }

  // Authoritative engineering derivations matching ContractReviewMatrix.jsx
  switch (fieldKey) {
    case 'valve_type':
      if (vType === 'CHECK') return sz <= 40 ? 'LIFT CHECK' : 'SWING CHECK';
      if (vType === 'GLOBE') return 'GLOBE';
      if (vType === 'GATE') return 'GATE';
      if (vType === 'BUTTERFLY') return 'BUTTERFLY';
      return 'BALL';

    case 'valve_size':
      return String(sz);

    case 'valve_class':
      return String(cl);

    case 'valve_api6d_monogram':
      return 'No';

    case 'valve_qsl_level':
      return 'No';

    case 'valve_design_type':
      if (vType === 'CHECK') return sz >= 50 ? 'Swing' : 'Lift';
      if (vType === 'GLOBE') return 'OS&Y';
      return [800, 900, 1500, 2500].includes(cl) ? '3 p/c' : (sz >= 650 ? '3 p/c' : '2 p/c');

    case 'valve_bore':
      if (vType === 'CHECK' || vType === 'GLOBE') return '-';
      if (/reduced bore|rb\b/i.test(desc)) return 'Reduced Bore';
      return 'Full Bore';

    case 'valve_end_connection':
      if (vType === 'GLOBE') return cl === 800 ? 'Socket Weld' : 'Flange end';
      return cl === 800 ? 'Socket Weld with Pups' : 'Flange end';

    case 'valve_operating':
      if (vType === 'CHECK') return '-';
      if (vType === 'GLOBE') {
        let reqGear = false;
        if (cl === 150) reqGear = sz >= 300;
        else if (cl === 300) reqGear = sz >= 250;
        else if (cl === 600) reqGear = sz >= 200;
        else if (cl >= 900) reqGear = sz >= 100;
        return reqGear ? 'Gear Box' : 'Hand Wheel';
      }
      let reqGear = false;
      if (cl === 150) reqGear = sz >= 200;
      else if (cl === 300) reqGear = sz >= 150;
      else if (cl === 600) reqGear = sz >= 100;
      else if (cl === 800) reqGear = false;
      else if (cl >= 900) reqGear = sz >= 80;
      return reqGear ? 'Gear Box' : 'Handle';

    case 'valve_ball_type':
      if (vType === 'CHECK') return '-';
      if (vType === 'GLOBE') return 'Globe';
      return isTmbv ? 'TMBV' : 'Floating';

    case 'valve_direction':
      if (vType === 'CHECK' || vType === 'GLOBE') return 'Uni Directional';
      return 'Bi Directional';

    case 'valve_service':
      return 'GAS';

    case 'valve_seat_type':
      if (vType === 'CHECK' || vType === 'GLOBE') return 'Metal Seat';
      return isTmbv ? 'Primary Metal Secondary Soft' : 'Soft Seat';

    case 'valve_design_std':
      if (vType === 'CHECK') return sz <= 40 ? 'BS 1868' : 'API 6D 25th Ed';
      if (vType === 'GLOBE') return sz <= 40 ? 'ISO 15761' : 'BS 1873';
      return sz <= 40 ? 'ISO 17292' : 'API 6D';

    case 'valve_testing_std':
      if (vType === 'CHECK') return sz <= 40 ? 'API 598' : 'API 6D 25th Ed';
      if (vType === 'GLOBE') return 'API 598';
      return sz <= 40 ? 'API 598' : 'API 6D 25TH ED';

    case 'valve_min_design_press':
    case 'valve_min_design_pressure': {
      const pressMap = { 150: '240 PSI', 300: '677 PSI', 600: '1335 PSI', 800: '1750 PSI', 900: '2000 PSI', 1500: '3333 PSI', 2500: '5553 PSI' };
      return pressMap[cl] || '240 PSI';
    }

    case 'valve_max_design_press':
    case 'valve_max_design_pressure': {
      const pressMap = { 150: '285 PSI', 300: '740 PSI', 600: '1480 PSI', 800: '1975 PSI', 900: '2220 PSI', 1500: '3705 PSI', 2500: '6170 PSI' };
      return pressMap[cl] || '285 PSI';
    }

    case 'valve_min_design_temp':
      return cl === 800 ? '-29° C' : '0° C';

    case 'valve_max_design_temp':
      return '65° C';

    case 'valve_drain_conn_size':
    case 'valve_drain_size':
      if (vType === 'CHECK' || vType === 'GLOBE') return 'No';
      return isTmbv ? (sz >= 200 ? '25 mm' : '15 mm') : 'No';

    case 'valve_vent_conn_size':
    case 'valve_vent_size':
      if (vType === 'CHECK' || vType === 'GLOBE') return 'No';
      return isTmbv ? (sz >= 200 ? '25 mm' : 'No') : 'No';

    case 'valve_lifting_lug': {
      let hasLug = false;
      if (!isTmbv) {
        if (cl === 150 && sz >= 100) hasLug = true;
        if (cl >= 300 && sz >= 80) hasLug = true;
      } else {
        if ((cl === 150 || cl === 300) && sz >= 80) hasLug = true;
        if (cl >= 600 && sz >= 50) hasLug = true;
      }
      return hasLug ? 'Yes' : 'No';
    }

    case 'valve_support_foot':
      return sz >= 200 ? 'Yes' : 'No';

    case 'valve_fire_safe':
      if (vType === 'GLOBE') return '-';
      if (vType === 'CHECK') return 'API 607';
      return isTmbv ? 'API 6FA' : 'API 607';

    case 'valve_antistatic':
      return (vType === 'CHECK' || vType === 'GLOBE') ? '-' : 'Yes';

    case 'valve_locking_device':
    case 'valve_locking':
      return 'No';

    case 'valve_for_pigging':
    case 'valve_pigging':
      return 'No';

    case 'valve_prv':
    case 'valve_pressure_relief':
      return 'No';

    case 'valve_cavity_relief':
      return 'No';

    case 'valve_bypass':
      return 'No';

    case 'valve_corrosion_allowance':
      return '1.5';

    case 'valve_special_req':
      return 'No';

    // MOC
    case 'valve_moc_body':
    case 'valve_body_moc':
      if (/A352\s*LCC|LCC/i.test(desc)) return 'ASTM A352 Gr. LCC';
      return cl === 800 ? 'ASTM A105' : 'ASTM A216 WCB';

    case 'valve_moc_ball':
    case 'valve_ball_moc':
      if (vType === 'GLOBE') return '13% Cr Steel';
      if (vType === 'CHECK') return cl === 800 ? '13% Cr Steel' : 'ASTM A216 Gr. WCB + STELLITED';
      return cl === 800 ? 'SS316' : 'ASTM A216 Gr. WCB + 75 MIC ENP';

    case 'valve_moc_stem':
    case 'valve_stem_moc':
      if (vType === 'GLOBE') return '13% Cr Steel';
      if (vType === 'CHECK') return 'ASTM A479 Gr. 410';
      return cl === 150 ? 'ASTM A479 Gr. 410' : 'ASTM 182 Gr. F6 cl2';

    case 'valve_moc_seat':
    case 'valve_seat_ring_moc':
      if (vType === 'CHECK' || vType === 'GLOBE') return 'ASTM A216 Gr. WCB + STELLITED';
      if (!isTmbv) return cl === 150 ? 'PTFE' : 'RPTFE';
      return cl === 150 ? 'PTFE + ASTM 182 Gr. F6 cl1' : 'RPTFE + ASTM 182 Gr. F6 cl1';

    case 'valve_moc_stud_nuts':
    case 'valve_fasteners_moc':
      return 'ASTM A193 Gr. B7 & ASTM A194 Gr. 2H';

    case 'valve_extended_bonnet':
      return 'No';

    // Testing
    case 'valve_mtc':
    case 'test_mtc':
      return 'EN 10204 3.1';

    case 'valve_test_rt':
    case 'test_rt': {
      let reqRt = false;
      if ([600, 900, 1500, 2500].includes(cl)) reqRt = true;
      else if ((cl === 150 || cl === 300) && sz >= 350) reqRt = true;
      return reqRt ? 'Yes' : 'No';
    }

    case 'valve_test_ut':
    case 'test_ut':
      return cl === 800 ? 'Yes' : 'No';

    case 'valve_test_dpt':
    case 'test_dpt':
    case 'valve_test_mpt':
    case 'test_mpt':
    case 'valve_nace_req':
    case 'test_nace':
    case 'valve_test_fugitive_emission':
    case 'test_fugitive_emission':
    case 'valve_test_cryogenic':
    case 'test_cryogenic':
    case 'valve_test_demo_function':
    case 'test_load_moments':
    case 'valve_test_igc':
    case 'test_igc':
    case 'valve_test_pmi':
    case 'test_pmi':
      return 'No';

    case 'valve_chemical_test':
    case 'test_chemical':
    case 'valve_physical_test':
    case 'test_physical':
    case 'valve_hardness_containing':
    case 'test_hardness_pressure_containing':
    case 'valve_hardness_controlling':
    case 'test_hardness_pressure_controlling':
      return 'Yes';

    case 'valve_heat_treatment_chart':
    case 'test_heat_treatment_chart':
      return 'No';

    case 'valve_test_impact_hardness':
    case 'test_impact':
      return cl === 800 ? '-29° C' : '0° C';

    case 'valve_pqr_wps':
    case 'test_pqr_wps':
      return 'Yes';

    case 'valve_solution_annealing':
    case 'test_solution_annealing':
      return vType === 'CHECK' ? 'No' : 'Yes';

    case 'valve_test_seismic':
    case 'test_seismic':
      return 'No';

    case 'valve_calib_cert':
    case 'test_calibration':
      return 'Yes';

    case 'valve_ibr_ce_cert':
    case 'test_ibr_ce':
    case 'valve_design_validation':
    case 'test_api6d_validation':
      return 'No';

    // Final Testing
    case 'valve_hydro_shell':
    case 'test_hydro_shell': {
      const shellMap = { 150: 450, 300: 1125, 600: 2250, 800: 3050, 900: 3300, 1500: 5500, 2500: 9200 };
      const p = shellMap[cl] || 450;
      let dur = '02';
      if (sz >= 500) dur = '30';
      else if (sz >= 300) dur = '15';
      else if (sz >= 150) dur = '05';
      return `${p} (${dur})`;
    }

    case 'valve_hydro_seat':
    case 'test_hydro_seat': {
      const seatMap = { 150: 325, 300: 825, 600: 1650, 800: 2250, 900: 2450, 1500: 4050, 2500: 6700 };
      const p = seatMap[cl] || 325;
      let dur = '02';
      if (sz >= 500) dur = '10';
      else if (sz >= 150) dur = '05';
      return `${p} (${dur})`;
    }

    case 'valve_air_seat':
    case 'test_air_seat': {
      if (vType === 'CHECK') return '-';
      let dur = '02';
      if (sz >= 500) dur = '10';
      else if (sz >= 150) dur = '05';
      return `100 (${dur})`;
    }

    case 'valve_dbb_hydro':
    case 'test_dbb_hydro': {
      if (vType === 'CHECK' || vType === 'GLOBE') return '-';
      if (isTmbv) {
        const seatMap = { 150: 325, 300: 825, 600: 1650, 800: 2250, 900: 2450, 1500: 4050, 2500: 6700 };
        const p = seatMap[cl] || 325;
        let dur = '02';
        if (sz >= 500) dur = '10';
        else if (sz >= 150) dur = '05';
        return `${p} (${dur})`;
      }
      return '-';
    }

    case 'valve_back_seat':
    case 'test_back_seat':
      if (vType === 'GLOBE') {
        const seatMap = { 150: 325, 300: 825, 600: 1650, 800: 2250, 900: 2450, 1500: 4050, 2500: 6700 };
        const p = seatMap[cl] || 325;
        return `${p} (02)`;
      }
      return '-';

    case 'valve_antistatic_test':
    case 'test_antistatic_test':
      if (vType === 'CHECK') return '-';
      if (vType === 'GLOBE') return 'No';
      return 'Yes';

    // Other Spec
    case 'valve_painting_dft':
    case 'spec_painting':
      return '120';

    case 'valve_packing':
    case 'spec_packing':
      return 'Yes';

    case 'valve_dispatch_by':
    case 'spec_dispatch':
      return 'By Road';

    case 'valve_location':
    case 'spec_location':
      return 'As per requirement';

    case 'valve_other_special':
    case 'spec_special_clause':
      return 'No';

    // Annexures
    case 'annex_a':
    case 'annex_b':
      return 'No';
    case 'annex_c':
    case 'annex_d':
    case 'annex_g':
    case 'annex_h':
      return (vType === 'CHECK' || vType === 'GLOBE') ? 'No' : 'Yes';
    case 'annex_e':
      return (vType === 'BALL' && isTmbv) ? 'Yes' : 'No';
    case 'annex_f':
    case 'annex_i':
    case 'annex_j':
    case 'annex_k':
    case 'annex_l':
    case 'annex_m':
      return 'No';

    default: {
      if (df[fieldKey] !== undefined && df[fieldKey] !== null) {
        return formatPdfValue(df[fieldKey], fallback);
      }
      if (itemObj[fieldKey] !== undefined && itemObj[fieldKey] !== null) {
        return formatPdfValue(itemObj[fieldKey], fallback);
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


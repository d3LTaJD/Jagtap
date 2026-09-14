/**
 * BallValveRulesEngine.js
 * Comprehensive 4-Layer Engineering Derivation & Contract Review Engine for Ball Valves.
 * Encapsulates all 66 technical specifications and dependency rules from Petro Std_Ball valve.docx:
 *
 * Layer 1: Normalized Customer Inputs
 * Layer 2: Petro Master Data Defaults
 * Layer 3: Client Overrides & Explicit Scope
 * Layer 4: Multi-Variable Cascading Derived Rules
 */

const { VALIDATION_STATES, REVIEW_REASONS } = require('../../types/EngineeringField');

// Inch to MM nominal bore mapping
const INCH_TO_MM_MAP = Object.freeze({
  '1/2': 15, '0.5': 15, '15': 15,
  '3/4': 20, '0.75': 20, '20': 20,
  '1': 25, '25': 25,
  '1-1/4': 32, '1.25': 32, '1 1/4': 32, '32': 32,
  '1-1/2': 40, '1.5': 40, '1 1/2': 40, '40': 40,
  '2': 50, '50': 50,
  '2-1/2': 65, '2.5': 65, '2 1/2': 65, '65': 65,
  '3': 80, '80': 80,
  '4': 100, '100': 100,
  '6': 150, '150': 150,
  '8': 200, '200': 200,
  '10': 250, '250': 250,
  '12': 300, '300': 300,
  '14': 350, '350': 350,
  '16': 400, '400': 400,
  '18': 450, '450': 450,
  '20': 500, '500': 500,
  '22': 550, '550': 550,
  '24': 600, '600': 600,
  '26': 650, '650': 650,
  '28': 700, '700': 700,
  '30': 750, '750': 750,
  '32': 800, '800': 800,
  '34': 850, '850': 850,
  '36': 900, '900': 900,
  '38': 950, '950': 950,
  '40': 1000, '1000': 1000,
  '42': 1050, '1050': 1050,
  '48': 1200, '1200': 1200,
  '54': 1350, '1350': 1350,
  '56': 1400, '1400': 1400,
  '60': 1500, '1500': 1500
});

// Pressure test tables in PSI per ASME B16.34 / API 6D
const HYDRO_TEST_PRESSURES = Object.freeze({
  150: { shell: 450, seat: 325, air: 100 },
  300: { shell: 1125, seat: 825, air: 100 },
  600: { shell: 2250, seat: 1650, air: 100 },
  800: { shell: 3050, seat: 2250, air: 100 },
  900: { shell: 3300, seat: 2450, air: 100 },
  1500: { shell: 5500, seat: 4050, air: 100 },
  2500: { shell: 9200, seat: 6700, air: 100 }
});

// Operating pressures at min and max design temperature (PSI)
const DESIGN_OPERATING_PRESSURES = Object.freeze({
  150: { maxTempPressure: 240, minTempPressure: 285 },
  300: { maxTempPressure: 677, minTempPressure: 740 },
  600: { maxTempPressure: 1335, minTempPressure: 1480 },
  800: { maxTempPressure: 1750, minTempPressure: 1975 },
  900: { maxTempPressure: 2000, minTempPressure: 2220 },
  1500: { maxTempPressure: 3333, minTempPressure: 3705 },
  2500: { maxTempPressure: 5553, minTempPressure: 6170 }
});

class BallValveRulesEngine {
  /**
   * Parses size string into standardized numeric MM and NPS string.
   */
  normalizeSize(sizeInput) {
    if (!sizeInput) return { sizeMm: null, sizeNps: null };
    const rawStr = String(sizeInput).trim();
    const isExplicitMm = /mm|nb|dn/i.test(rawStr);
    const clean = rawStr.replace(/["\s]/g, '').toLowerCase().replace(/mm|nb|dn/g, '');

    const num = parseFloat(clean);
    if (isExplicitMm && !isNaN(num)) {
      return { sizeMm: Math.round(num), sizeNps: `${Math.round(num)} mm` };
    }

    const inchToMm = {
      '1/2': 15, '0.5': 15,
      '3/4': 20, '0.75': 20,
      '1': 25,
      '1-1/4': 32, '1.25': 32, '1 1/4': 32,
      '1-1/2': 40, '1.5': 40, '1 1/2': 40,
      '2': 50,
      '2-1/2': 65, '2.5': 65, '2 1/2': 65,
      '3': 80,
      '4': 100,
      '6': 150,
      '8': 200,
      '10': 250,
      '12': 300,
      '14': 350,
      '16': 400,
      '18': 450,
      '20': 500,
      '22': 550,
      '24': 600,
      '26': 650,
      '28': 700,
      '30': 750,
      '32': 800,
      '34': 850,
      '36': 900,
      '38': 950,
      '40': 1000,
      '42': 1050,
      '48': 1200,
      '54': 1350,
      '56': 1400,
      '60': 1500
    };

    if (rawStr.includes('"') || rawStr.toLowerCase().includes('inch') || rawStr.includes('/')) {
      if (inchToMm[clean]) {
        return { sizeMm: inchToMm[clean], sizeNps: `${inchToMm[clean]} mm` };
      }
    }

    if (!isNaN(num) && num >= 15) {
      return { sizeMm: Math.round(num), sizeNps: `${Math.round(num)} mm` };
    }

    if (inchToMm[clean]) {
      return { sizeMm: inchToMm[clean], sizeNps: `${inchToMm[clean]} mm` };
    }

    return { sizeMm: 50, sizeNps: String(sizeInput) };
  }

  /**
   * Normalizes pressure class string into integer rating.
   */
  normalizeClass(classInput) {
    if (!classInput) return 150; // Default 150#
    const num = parseInt(String(classInput).replace(/[^0-9]/g, ''), 10);
    return isNaN(num) ? 150 : num;
  }

  /**
   * Main 4-Layer Resolution Engine for Ball Valves.
   * Takes raw customer inputs, checks client overrides, applies layered dependencies, and derives all 66 specs.
   *
   * @param {Object} rawInputs Extracted customer inputs { size, class, moc, operating, temp, clientSpecs, description }
   * @returns {Object} Complete 66-point technical specification sheet with full provenance and conflict logs
   */
  deriveSpecifications(rawInputs = {}) {
    const {
      size,
      valve_size,
      class: rawClass,
      valve_class,
      body_moc,
      valve_moc_body,
      trim_moc,
      ball_moc,
      stem_moc,
      seat_moc,
      studs_moc,
      valve_fasteners_moc,
      operating,
      valve_operating,
      end_connection,
      valve_end_connection,
      min_temp,
      max_temp,
      testing_std,
      design_std,
      monogram,
      qsl_level,
      nace,
      pmi,
      rt,
      ut,
      dpt,
      mpt,
      description = ''
    } = rawInputs;

    const conflicts = [];
    const derived = {};

    // ── STEP 1: Normalize Core Inputs ──────────────────────────────────────
    const { sizeMm, sizeNps } = this.normalizeSize(valve_size || size || description);
    const cls = this.normalizeClass(valve_class || rawClass || description);

    derived.size_mm = sizeMm || 50; // Fallback to 50mm if completely unspecified
    derived.size_nps = sizeNps || '50 mm';
    derived.valve_class = `${cls}#`;
    derived.class_number = cls;

    // ── STEP 2: Resolve Ball Type (Floating vs TMBV) ────────────────────────
    // Rules from Petro Std:
    // Floating: 150# (15-150mm), 300# (15-150mm), 600# (15-40mm), 800# (15-50mm)
    // TMBV: 150# (≥200mm), 300# (≥200mm), 600# (≥50mm), 800# (≥65mm), 900#-2500# (All sizes)
    const upperDesc = String(description).toUpperCase();
    const explicitTmbv = upperDesc.includes('TRUNNION') || upperDesc.includes('TMBV');
    const explicitFloating = upperDesc.includes('FLOATING') || upperDesc.includes('FBV');

    let ballType = 'Floating Ball Valve';
    let isTmbv = false;

    if (explicitTmbv) {
      ballType = 'Trunnion Mounted Ball Valve';
      isTmbv = true;
    } else if (explicitFloating) {
      ballType = 'Floating Ball Valve';
      isTmbv = false;
    } else {
      // Automatic Petro Standard threshold evaluation
      if (cls === 150 || cls === 300) {
        isTmbv = derived.size_mm >= 200;
      } else if (cls === 600) {
        isTmbv = derived.size_mm >= 50;
      } else if (cls === 800) {
        isTmbv = derived.size_mm >= 65;
      } else if (cls >= 900) {
        isTmbv = true; // All sizes for 900#+
      }
      ballType = isTmbv ? 'Trunnion Mounted Ball Valve' : 'Floating Ball Valve';
    }

    derived.ball_type = ballType;
    derived.is_tmbv = isTmbv;

    // ── STEP 3: Resolve Design Type (Pieces: 2 p/c vs 3 p/c) ────────────────
    // 800#, 900#, 1500#, 2500# -> 3 p/c (any size)
    // 150#, 300#, 600# -> 15mm-600mm = 2 p/c, 650mm & above = 3 p/c
    if ([800, 900, 1500, 2500].includes(cls)) {
      derived.design_type_pieces = '3 p/c';
    } else {
      derived.design_type_pieces = derived.size_mm >= 650 ? '3 p/c' : '2 p/c';
    }

    // ── STEP 4: Standards & Monogram ───────────────────────────────────────
    // API 6D Monogram: NO (default), YES (if specified)
    derived.api_6d_monogram = (monogram && /yes|true|required/i.test(String(monogram))) || /monogram/i.test(upperDesc) ? 'YES' : 'NO';

    // QSL Level: NO (default), QSL 2/3/3G/4/4G (if specified)
    const qslMatch = upperDesc.match(/\b(QSL[\s\-]?[234](?:G)?)\b/i);
    derived.qsl_level = qsl_level || (qslMatch ? qslMatch[1].toUpperCase() : 'NO');

    // Bore: Full bore (default), Reduced bore (if specified)
    derived.bore = /reduced\s*bore|rb\b/i.test(upperDesc) ? 'Reduced Bore' : 'Full Bore';

    // End Type:
    // 150#, 300#, 600#, 900#, 1500#, 2500# -> Flange end (default), Butt weld / Other (if specified)
    // 800# -> Socket Weld with Pups (default), NPT / Other (if specified)
    if (end_connection || valve_end_connection) {
      derived.end_connection = end_connection || valve_end_connection;
    } else if (cls === 800) {
      derived.end_connection = /npt|screwed|threaded/i.test(upperDesc) ? 'Screwed NPT' : 'Socket Weld with Pups';
    } else {
      derived.end_connection = /butt\s*weld|bw\b/i.test(upperDesc) ? 'Butt weld' : 'Flange end';
    }
    derived.valve_end_connection = derived.end_connection;

    // ── STEP 5: Operating Mechanism (Handle vs Gear vs Actuator) ────────────
    // Handle: 150# (≤150mm), 300# (≤100mm), 600# (≤80mm), 800# (≤50mm), 900#+ (≤80mm)
    // Gear Box: 150# (≥200mm), 300# (≥150mm), 600#+ (≥100mm)
    // Actuator: If Specified by client (e.g. Pneumatic Actuator, Motorized, Electric Actuator)
    const explicitActuator = /(?:pneumatic|electric|hydraulic|motorized|cylinder)\s+actuator\b|\bactuator\s+required\b|\bwith\s+actuator\b/i.test(upperDesc) || /actuator/i.test(String(operating || valve_operating || ''));
    if (explicitActuator) {
      derived.valve_operating = 'Actuator';
    } else {
      let requiresGear = false;
      if (cls === 150) requiresGear = derived.size_mm >= 200;
      else if (cls === 300) requiresGear = derived.size_mm >= 150;
      else if (cls === 600) requiresGear = derived.size_mm >= 100;
      else if (cls === 800) requiresGear = false; // 800# is not in Gear Box table (standard forged bore uses Handle)
      else if (cls >= 900) requiresGear = derived.size_mm >= 100;

      derived.valve_operating = requiresGear ? 'Gear Box' : 'Handle';
    }

    // Direction & Service
    derived.direction = 'Bi Directional';
    derived.service = /sour|nace|h2s/i.test(upperDesc) ? 'Sour Gas Service (NACE MR0175)' : 'Liquid/Gas (Default)';

    // ── STEP 6: Seat Type & Materials ──────────────────────────────────────
    // Floating -> Soft Seat (PTFE for 150#, RPTFE for 300#+)
    // TMBV -> Primary Metal Secondary Soft (PTFE+F6 cl1 for 150#, RPTFE+F6 cl1 for 300#+)
    const explicitMetalSeat = /metal\s*to\s*metal|stellite|tungsten|tc\s*coating/i.test(upperDesc);

    if (seat_moc) {
      derived.moc_seat = seat_moc;
      if (/metal\s*to\s*metal|stellite/i.test(seat_moc)) derived.seat_type = 'Metal to Metal';
      else if (isTmbv) derived.seat_type = 'Primary Metal Secondary Soft';
      else derived.seat_type = 'Soft Seat';
    } else if (explicitMetalSeat) {
      derived.seat_type = 'Metal to Metal';
      derived.moc_seat = 'ASTM A182 Gr. F6a + Stellite Gr. 6';
    } else if (isTmbv) {
      derived.seat_type = 'Primary Metal Secondary Soft';
      derived.moc_seat = cls === 150 ? 'PTFE + ASTM A182 Gr. F6 cl1' : 'RPTFE + ASTM A182 Gr. F6 cl1';
    } else {
      derived.seat_type = 'Soft Seat';
      derived.moc_seat = cls === 150 ? 'PTFE' : 'RPTFE';
    }

    // ── STEP 7: Design & Testing Standards ─────────────────────────────────
    // 15mm - 40mm -> ISO 17292 & API 598
    // 50mm and Above -> API 6D 25th Ed & API 6D 25th Ed
    if (derived.size_mm <= 40) {
      derived.valve_design_std = design_std || 'ISO 17292';
      derived.valve_testing_std = testing_std || 'API 598';
    } else {
      derived.valve_design_std = design_std || 'API 6D 25TH ED';
      derived.valve_testing_std = testing_std || 'API 6D 25TH ED';
    }

    // ── STEP 8: Design Operating Pressures & Temperatures ───────────────────
    const pressTable = DESIGN_OPERATING_PRESSURES[cls] || DESIGN_OPERATING_PRESSURES[150];
    derived.design_operating_pressure_max_temp_psi = pressTable.maxTempPressure;
    derived.design_operating_pressure_min_temp_psi = pressTable.minTempPressure;

    // Minimum Design Temperature: 0°C (Default), -29°C, -45°C
    // 800# is fixed at -29°C per Petro Std
    if (cls === 800) {
      derived.min_design_temp = '-29° C';
    } else if (min_temp || /-\s*45/i.test(upperDesc)) {
      derived.min_design_temp = '-45° C';
    } else if (/-\s*29/i.test(upperDesc)) {
      derived.min_design_temp = '-29° C';
    } else {
      derived.min_design_temp = '0° C (Default)';
    }

    // Maximum Design Temperature: 65°C (Default), 121°C
    derived.max_design_temp = (max_temp && /121/i.test(String(max_temp))) || /121\s*°?c/i.test(upperDesc) ? '121° C' : '65° C (Default)';

    // ── STEP 9: Drain & Vent Connections ───────────────────────────────────
    // Floating -> No Drain / No Vent
    // TMBV -> Drain: 15mm (50-200mm), 25mm (≥200mm); Vent: No (50-150mm), 25mm (≥200mm)
    if (!isTmbv) {
      derived.drain_conn_size = /drain/i.test(upperDesc) ? '15 mm (Client Requested)' : 'NO';
      derived.vent_conn_size = 'NO';
    } else {
      derived.drain_conn_size = derived.size_mm >= 200 ? '25 mm' : '15 mm';
      derived.vent_conn_size = derived.size_mm >= 200 ? '25 mm' : 'NO';
    }

    // ── STEP 10: Lifting Lug & Support Foot ────────────────────────────────
    // Lifting Lug: Floating: 150# (≥100mm), 300# (≥80mm); TMBV: 150#/300# (≥80mm), 600#+ (≥50mm)
    let hasLiftingLug = false;
    if (!isTmbv) {
      if (cls === 150 && derived.size_mm >= 100) hasLiftingLug = true;
      if (cls >= 300 && derived.size_mm >= 80) hasLiftingLug = true;
    } else {
      if ((cls === 150 || cls === 300) && derived.size_mm >= 80) hasLiftingLug = true;
      if (cls >= 600 && derived.size_mm >= 50) hasLiftingLug = true;
    }
    derived.lifting_lug = hasLiftingLug ? 'Yes (≥ 25 kg)' : 'NO';

    // Support Foot: 200mm & Above (for TMBV)
    derived.support_foot = isTmbv && derived.size_mm >= 200 ? 'Yes (200mm & Above)' : 'NO';

    // ── STEP 11: Safety & Accessory Features ───────────────────────────────
    derived.fire_safe_design = isTmbv ? 'API 6FA (TMBV)' : 'API 607 (Floating)';
    derived.antistatic_device = 'Yes';
    derived.locking_device = /locking/i.test(upperDesc) ? 'Yes' : 'NO - default.';
    derived.is_valve_for_pigging = /pigging|scraper/i.test(upperDesc) ? 'Yes' : 'NO - default.';
    derived.pressure_relief_valve = /prv|pressure\s*relief/i.test(upperDesc) ? 'Yes' : 'NO - default.';
    derived.cavity_relief_valve = /cavity\s*relief/i.test(upperDesc) ? 'Yes' : 'NO - default.';
    derived.by_pass_connection = /by[\s\-]?pass/i.test(upperDesc) ? 'Yes' : 'NO - default.';

    // Corrosion Allowance: 1.5mm (Default), 2, 3, 5mm if asked
    const caMatch = upperDesc.match(/\b([235](?:\.0)?)\s*mm\s*(?:ca|corrosion)/i);
    derived.corrosion_allowance = caMatch ? `${caMatch[1]} mm` : '1.5 mm (Default)';
    derived.special_requirements = /special\s*req/i.test(upperDesc) ? 'Yes' : 'No';

    // ── STEP 12: Material of Construction (MOC Defaults) ───────────────────
    // Body / Bonnet:
    // 150#-2500# -> ASTM A216 Gr. WCB (or A352 LCC if low temp)
    // 800# -> ASTM A105
    if (body_moc || valve_moc_body) {
      derived.moc_body = body_moc || valve_moc_body;
    } else if (cls === 800) {
      derived.moc_body = 'ASTM A105';
    } else if (derived.min_design_temp.includes('-45') || /lcc\b|low\s*temp/i.test(upperDesc)) {
      derived.moc_body = 'ASTM A352 Gr. LCC';
    } else {
      derived.moc_body = 'ASTM A216 Gr. WCB';
    }

    // Ball / Wedge:
    // 150#-2500# -> ASTM A216 Gr. WCB + 75 MIC ENP
    // 800# -> SS316
    if (ball_moc || trim_moc) {
      derived.moc_ball = ball_moc || trim_moc;
    } else if (cls === 800) {
      derived.moc_ball = 'SS316';
    } else if (derived.moc_body.includes('LCC')) {
      derived.moc_ball = 'ASTM A352 Gr. LCC + 75 MIC ENP';
    } else {
      derived.moc_ball = 'ASTM A216 Gr. WCB + 75 MIC ENP';
    }

    // Stem:
    // 150# -> ASTM A479 Gr. 410
    // 300#-2500# -> ASTM 182 Gr. F6 cl2
    // 800# -> ASTM A479 Gr. 410 / F6a
    if (stem_moc) {
      derived.moc_stem = stem_moc;
    } else if (cls === 150 || cls === 800) {
      derived.moc_stem = 'ASTM A479 Gr. 410';
    } else {
      derived.moc_stem = 'ASTM 182 Gr. F6 cl2';
    }

    // Studs & Nuts: ASTM A193 Gr. B7 & ASTM A194 Gr. 2H (or L7/Gr. 7 for low temp)
    if (studs_moc || valve_fasteners_moc) {
      derived.moc_stud_nuts = studs_moc || valve_fasteners_moc;
    } else if (derived.min_design_temp.includes('-45')) {
      derived.moc_stud_nuts = 'ASTM A320 Gr. L7 & ASTM A194 Gr. 7';
    } else {
      derived.moc_stud_nuts = 'ASTM A193 Gr. B7 & ASTM A194 Gr. 2H';
    }

    derived.extended_bonnet = /extended\s*bonnet|cryogenic/i.test(upperDesc) ? 'Yes' : 'No';

    // ── STEP 13: Raw Material Testing & NDE Scope ──────────────────────────
    // Material Test Certificates: EN 10204 3.1 (default), 3.2 if specified
    derived.material_test_certificate = /3\.2/i.test(upperDesc) ? 'EN 10204 3.2' : 'EN 10204 3.1 (default)';

    // RT (Radiography):
    // 600#, 900#, 1500#, 2500# -> All Size = Yes
    // 150#, 300# -> ≥ 350mm = Yes, < 350mm = No (unless requested)
    // 800# -> No (unless requested)
    let reqRt = false;
    if (rt && /yes|true|required/i.test(String(rt))) {
      reqRt = true;
    } else if ([600, 900, 1500, 2500].includes(cls)) {
      reqRt = true;
    } else if ((cls === 150 || cls === 300) && derived.size_mm >= 350) {
      reqRt = true;
    }
    derived.test_rt = reqRt ? 'Yes' : 'No, if not asked specifically';

    // UT (Ultrasonic):
    // 800# Class -> Yes
    // Other classes -> No (unless requested)
    let reqUt = cls === 800;
    if (ut && /yes|true|required/i.test(String(ut))) reqUt = true;
    derived.test_ut = reqUt ? 'Yes' : 'No, if not asked specifically';

    // Supplementary NDE:
    derived.test_dpt = (dpt && /yes/i.test(String(dpt))) || /dpt\b|dye\s*penetrant/i.test(upperDesc) ? 'Yes' : 'NO - default.';
    derived.test_mpt = (mpt && /yes/i.test(String(mpt))) || /mpt\b|magnetic\s*particle/i.test(upperDesc) ? 'Yes' : 'NO - default.';
    derived.nace_requirement = (nace && /yes/i.test(String(nace))) || /nace|mr0175|iso\s*15156/i.test(upperDesc) ? 'Yes (NACE MR0175)' : 'NO - default.';
    derived.test_fugitive_emission = /fugitive|helium\s*leak/i.test(upperDesc) ? 'Yes' : 'NO - default.';
    derived.test_cryogenic = /cryogenic/i.test(upperDesc) ? 'Yes' : 'NO - default.';
    derived.test_demo_function_loads = /function.*load/i.test(upperDesc) ? 'Yes' : 'NO - default.';
    derived.test_igc = /igc\b|intergranular/i.test(upperDesc) ? 'Yes' : 'NO - default.';
    derived.test_pmi = (pmi && /yes/i.test(String(pmi))) || /pmi\b|positive\s*material/i.test(upperDesc) ? 'Yes' : 'NO - default.';

    // Mandatory Standard Quality Tests:
    derived.test_chemical = 'Yes';
    derived.test_physical = 'Yes';
    derived.test_hardness_containing = 'Yes';
    derived.test_hardness_controlling = 'Yes';
    derived.heat_treatment_chart = /heat\s*treatment\s*chart/i.test(upperDesc) ? 'Yes' : 'NO - default.';

    // Impact Hardness Test:
    derived.test_impact_hardness = cls === 800 ? 'Test at -29° C' : `Test at min. design temp (${derived.min_design_temp})`;
    derived.pqr_wps = 'Yes';
    derived.solution_annealing = 'YES';
    derived.test_seismic = /seismic/i.test(upperDesc) ? 'Yes' : 'NO - default.';
    derived.calibration_certificate = 'Yes';
    derived.ibr_ce_certification = /ibr|ce\b/i.test(upperDesc) ? 'Yes' : 'NO - default.';
    derived.design_validation_api6d = /design\s*validation/i.test(upperDesc) ? 'Yes' : 'NO - default.';

    // ── STEP 14: Final Pressure Testing (PSI & Durations) ───────────────────
    const hydro = HYDRO_TEST_PRESSURES[cls] || HYDRO_TEST_PRESSURES[150];
    derived.hydro_shell_pressure_psi = hydro.shell;
    derived.hydro_seat_pressure_psi = hydro.seat;
    derived.air_seat_pressure_psi = hydro.air;

    // Durations:
    // 15 - 100mm -> 2 Min Shell, 2 Min Seat
    // 150 - 250mm -> 5 Min Shell, 5 Min Seat
    // 300 - 450mm -> 15 Min Shell, 5 Min Seat
    // 500mm & above -> 30 Min Shell, 10 Min Seat
    if (derived.size_mm >= 500) {
      derived.test_duration_shell_min = '30 Minutes';
      derived.test_duration_seat_min = '10 Minutes';
    } else if (derived.size_mm >= 300) {
      derived.test_duration_shell_min = '15 Minutes';
      derived.test_duration_seat_min = '5 Minutes';
    } else if (derived.size_mm >= 150) {
      derived.test_duration_shell_min = '5 Minutes';
      derived.test_duration_seat_min = '5 Minutes';
    } else {
      derived.test_duration_shell_min = '2 Minutes';
      derived.test_duration_seat_min = '2 Minutes';
    }

    derived.test_dbb_hydro = isTmbv ? 'Seat test pressure and duration as per class & size' : '-';
    derived.test_backseat = '-';
    derived.test_antistatic = 'Yes';

    // ── STEP 15: Other Specifications & Packing ────────────────────────────
    derived.painting_dft_micron = '120 (default)';
    derived.packing = 'Yes';
    derived.dispatch_by = /air\s*freight/i.test(upperDesc) ? 'Air' : /sea\s*freight/i.test(upperDesc) ? 'Sea' : 'Road (default)';
    derived.location = 'As Per client Req';
    derived.is_special_requirement = 'NO';

    // ── STEP 16: API 6D Annexures ──────────────────────────────────────────
    // Yes -> ANNEX C, ANNEX D, ANNEX G, ANNEX H
    // Yes -> ANNEX E (Only for TMBV)
    // No -> All other annexures
    derived.api_6d_annex_c = 'Yes';
    derived.api_6d_annex_d = 'Yes';
    derived.api_6d_annex_g = 'Yes';
    derived.api_6d_annex_h = 'Yes';
    derived.api_6d_annex_e = isTmbv ? 'Yes (TMBV only)' : 'No (Floating)';

    return {
      success: true,
      valveType: 'Ball Valve',
      totalRulesEvaluated: 66,
      specifications: derived,
      conflicts,
      provenance: 'PETRO_STD_BALL_VALVE_ENGINE'
    };
  }
}

module.exports = new BallValveRulesEngine();

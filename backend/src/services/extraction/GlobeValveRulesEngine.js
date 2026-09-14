/**
 * GlobeValveRulesEngine.js
 * Comprehensive 4-Layer Engineering Derivation & Contract Review Engine for Globe Valves.
 * Encapsulates all 66 technical specifications and dependency rules from Petro Std_Globe Valve .docx:
 *
 * - Size: 15mm to 1500mm (NPS 1/2" to 60")
 * - Specific Valve Type: Globe Valve
 * - Design Type: "OS&Y" (Outside Screw & Yoke)
 * - Direction: "Uni Direction"
 * - Seat: Metal Seat (ASTM A216 Gr. WCB + STELLITED)
 * - Disc / Plug: 13% Cr Steel (All classes)
 * - Stem: 13% Cr Steel (All classes)
 * - Operating: Hand Wheel vs Gear Box vs Actuator
 *   • Hand Wheel: 150# (≤250mm), 300# (≤200mm), 600# (≤150mm), 800# (≤50mm), 900#-2500# (≤80mm)
 *   • Gear Box: 150# (≥300mm), 300# (≥250mm), 600# (≥200mm), 900#-2500# (≥100mm)
 * - Standards: ISO 15761 (15-40mm) / BS 1873 (50mm+)
 * - Testing: API 598 (All Sizes)
 * - Back Seat Test: Yes (Seat test pressure and duration as per class & size)
 * - Antistatic Test: No
 * - Annexures: No for all API 6D annexures
 */

const HYDRO_TEST_PRESSURES = Object.freeze({
  150: { shell: 450, seat: 325, air: 100 },
  300: { shell: 1125, seat: 825, air: 100 },
  600: { shell: 2250, seat: 1650, air: 100 },
  800: { shell: 3050, seat: 2250, air: 100 },
  900: { shell: 3300, seat: 2450, air: 100 },
  1500: { shell: 5500, seat: 4050, air: 100 },
  2500: { shell: 9200, seat: 6700, air: 100 }
});

const DESIGN_OPERATING_PRESSURES = Object.freeze({
  150: { maxTempPressure: 240, minTempPressure: 285 },
  300: { maxTempPressure: 677, minTempPressure: 740 },
  600: { maxTempPressure: 1335, minTempPressure: 1480 },
  800: { maxTempPressure: 1750, minTempPressure: 1975 },
  900: { maxTempPressure: 2000, minTempPressure: 2220 },
  1500: { maxTempPressure: 3333, minTempPressure: 3705 },
  2500: { maxTempPressure: 5553, minTempPressure: 6170 }
});

class GlobeValveRulesEngine {
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
    if (!classInput) return 150;
    const num = parseInt(String(classInput).replace(/[^0-9]/g, ''), 10);
    return isNaN(num) ? 150 : num;
  }

  /**
   * Main 4-Layer Resolution Engine for Globe Valves.
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

    // ── STEP 1: Normalize Size and Class ───────────────────────────────────
    const { sizeMm, sizeNps } = this.normalizeSize(valve_size || size || description);
    const cls = this.normalizeClass(valve_class || rawClass || description);

    derived.size_mm = sizeMm || 50;
    derived.size_nps = sizeNps || '50 mm';
    derived.valve_class = `${cls}#`;
    derived.class_number = cls;

    // ── STEP 2: Design Type (OS&Y) ─────────────────────────────────────────
    const upperDesc = String(description).toUpperCase();
    derived.specific_valve_type = 'Globe Valve';
    derived.design_type = 'OS&Y';
    derived.valve_design_type = 'OS&Y'; // Row 1 in matrix checklist

    // ── STEP 3: Standards & Monogram ───────────────────────────────────────
    derived.api_6d_monogram = 'NO';
    derived.qsl_level = 'NO';
    derived.bore = '-';

    // End Type:
    // 150#-2500# -> Flanged End (default), Butt Weld (if specified)
    // 800# -> Socket Weld (default), NPT (if specified)
    if (end_connection || valve_end_connection) {
      derived.end_connection = end_connection || valve_end_connection;
    } else if (cls === 800) {
      derived.end_connection = /npt|screwed|threaded/i.test(upperDesc) ? 'Screwed NPT' : 'Socket Weld';
    } else {
      derived.end_connection = /butt\s*weld|bw\b/i.test(upperDesc) ? 'Butt Weld' : 'Flanged RF';
    }

    // ── STEP 4: Operating Mechanism (Hand Wheel vs Gear Box vs Actuator) ───
    // Hand Wheel: 150# (≤250mm), 300# (≤200mm), 600# (≤150mm), 800# (≤50mm), 900#-2500# (≤80mm)
    // Gear Box: 150# (≥300mm), 300# (≥250mm), 600# (≥200mm), 900#-2500# (≥100mm)
    // Actuator: If Specified by client (e.g. Pneumatic Actuator, Motorized, Electric Actuator)
    const explicitActuator = /(?:pneumatic|electric|hydraulic|motorized|cylinder)\s+actuator\b|\bactuator\s+required\b|\bwith\s+actuator\b/i.test(upperDesc) || /actuator/i.test(String(operating || valve_operating || ''));
    if (explicitActuator) {
      derived.valve_operating = 'Actuator';
    } else {
      let requiresGear = false;
      if (cls === 150) requiresGear = derived.size_mm >= 300;
      else if (cls === 300) requiresGear = derived.size_mm >= 250;
      else if (cls === 600) requiresGear = derived.size_mm >= 200;
      else if (cls === 800) requiresGear = false; // 800# is not in Gear Box table (standard forged bore uses Hand Wheel)
      else if (cls >= 900) requiresGear = derived.size_mm >= 100;

      derived.valve_operating = requiresGear ? 'Gear Box' : 'Hand Wheel';
    }

    // Ball Type: Globe / Plug Disc
    derived.ball_type = 'Globe';
    derived.valve_ball_type = 'Globe';

    // Direction & Service: Globe valves are strictly Uni Direction
    derived.direction = 'Uni Direction';
    derived.service = /sour|nace|h2s/i.test(upperDesc) ? 'Sour Gas Service (NACE MR0175)' : 'Liquid/Gas (Default)';

    // Seat Type: Metal Seat
    derived.seat_type = 'Metal Seat';
    derived.valve_seat_type = 'Metal Seat';
    derived.moc_seat = seat_moc || 'ASTM A216 Gr. WCB + STELLITED';

    // ── STEP 5: Design & Testing Standards ─────────────────────────────────
    // 15mm - 40mm -> ISO 15761 & API 598
    // 50mm and Above -> BS 1873 & API 598
    if (derived.size_mm <= 40) {
      derived.valve_design_std = design_std || 'ISO 15761';
      derived.valve_testing_std = testing_std || 'API 598';
    } else {
      derived.valve_design_std = design_std || 'BS 1873';
      derived.valve_testing_std = testing_std || 'API 598';
    }

    // ── STEP 6: Design Operating Pressures & Temperatures ───────────────────
    const pressTable = DESIGN_OPERATING_PRESSURES[cls] || DESIGN_OPERATING_PRESSURES[150];
    derived.design_operating_pressure_max_temp_psi = pressTable.maxTempPressure;
    derived.design_operating_pressure_min_temp_psi = pressTable.minTempPressure;

    // Minimum Design Temperature: 0°C (Default), -29°C, -45°C (800# is fixed at -29°C)
    if (cls === 800) {
      derived.min_design_temp = '-29° C';
    } else if (min_temp || /-\s*45/i.test(upperDesc)) {
      derived.min_design_temp = '-45° C';
    } else if (/-\s*29/i.test(upperDesc)) {
      derived.min_design_temp = '-29° C';
    } else {
      derived.min_design_temp = '0° C (Default)';
    }

    derived.max_design_temp = (max_temp && /121/i.test(String(max_temp))) || /121\s*°?c/i.test(upperDesc) ? '121° C' : '65° C (Default)';

    // ── STEP 7: Drain, Vent, Lug & Foot ────────────────────────────────────
    derived.drain_conn_size = /drain/i.test(upperDesc) ? '15 mm (Client Requested)' : 'NO - default.';
    derived.vent_conn_size = /vent/i.test(upperDesc) ? '15 mm (Client Requested)' : 'NO - default.';

    // Lifting Lug: 25 kg & above (≥80mm)
    const hasLiftingLug = derived.size_mm >= 80;
    derived.lifting_lug = hasLiftingLug ? 'Yes (25 kg & above)' : 'NO';

    // Support Foot: 200mm & above
    derived.support_foot = derived.size_mm >= 200 ? 'Yes (200mm & above)' : 'NO';

    derived.fire_safe_design = '-';
    derived.antistatic_device = '-';
    derived.locking_device = 'NO - default.';
    derived.is_valve_for_pigging = 'NO - default.';
    derived.pressure_relief_valve = 'NO - default.';
    derived.cavity_relief_valve = 'NO - default.';
    derived.by_pass_connection = 'NO - default.';
    derived.corrosion_allowance = '1.5 mm (Default)';
    derived.special_requirements = 'No';

    // ── STEP 8: Material of Construction (MOC) ─────────────────────────────
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

    // Disc / Plug: 13% Cr Steel across all classes
    derived.moc_ball = ball_moc || trim_moc || '13% Cr Steel';

    // Stem: 13% Cr Steel across all classes
    derived.moc_stem = stem_moc || '13% Cr Steel';

    // Studs & Nuts: ASTM A193 Gr. B7 & ASTM A194 Gr. 2H
    derived.moc_stud_nuts = studs_moc || valve_fasteners_moc || 'ASTM A193 Gr. B7 & ASTM A194 Gr. 2H';
    derived.extended_bonnet = 'No - default';

    // ── STEP 9: Raw Material Testing & NDE Scope ───────────────────────────
    derived.material_test_certificate = /3\.2/i.test(upperDesc) ? 'EN 10204 3.2' : 'EN 10204 3.1 (default)';

    // RT Priority:
    // 1. Explicit Client Request -> Yes
    // 2. Class 800# -> Strictly NO unless client requested
    // 3. Classes 600#, 900#, 1500#, 2500# -> All Sizes = Yes
    // 4. Classes 150#, 300# -> ≥ 350mm = Yes, 15mm-300mm = No unless requested
    let reqRt = false;
    if ((rt && /yes|true|required/i.test(String(rt))) || /rt\s*required|100%\s*rt|radiograph/i.test(upperDesc)) {
      reqRt = true;
    } else if (cls === 800) {
      reqRt = false;
    } else if ([600, 900, 1500, 2500].includes(cls)) {
      reqRt = true;
    } else if ((cls === 150 || cls === 300) && derived.size_mm >= 350) {
      reqRt = true;
    } else {
      reqRt = false;
    }
    derived.test_rt = reqRt ? 'Yes' : 'No, if not asked specifically';

    // UT: 800# Class = Yes, others = No unless requested
    let reqUt = cls === 800;
    if ((ut && /yes|true|required/i.test(String(ut))) || /ut\s*required|ultrasonic/i.test(upperDesc)) reqUt = true;
    derived.test_ut = reqUt ? 'Yes' : 'No, if not asked specifically';

    derived.test_dpt = (dpt && /yes/i.test(String(dpt))) || /dpt\b|dye\s*penetrant/i.test(upperDesc) ? 'Yes' : 'NO - default.';
    derived.test_mpt = (mpt && /yes/i.test(String(mpt))) || /mpt\b|magnetic\s*particle/i.test(upperDesc) ? 'Yes' : 'NO - default.';
    derived.nace_requirement = (nace && /yes/i.test(String(nace))) || /nace|mr0175/i.test(upperDesc) ? 'Yes (NACE MR0175)' : 'NO - default.';
    derived.test_fugitive_emission = /fugitive/i.test(upperDesc) ? 'Yes' : 'NO - default.';
    derived.test_cryogenic = /cryogenic/i.test(upperDesc) ? 'Yes' : 'NO - default.';
    derived.test_demo_function_loads = 'NO - default.';
    derived.test_igc = /igc\b/i.test(upperDesc) ? 'Yes' : 'NO - default.';
    derived.test_pmi = (pmi && /yes/i.test(String(pmi))) || /pmi\b|positive\s*material/i.test(upperDesc) ? 'Yes' : 'NO - default.';

    // Mandatory Quality Tests:
    derived.test_chemical = 'Yes';
    derived.test_physical = 'Yes';
    derived.test_hardness_containing = 'Yes';
    derived.test_hardness_controlling = 'Yes';
    derived.heat_treatment_chart = 'NO - default.';
    derived.test_impact_hardness = cls === 800 ? 'Test at -29° C' : `Test at min. design temp (${derived.min_design_temp})`;
    derived.pqr_wps = 'Yes';
    derived.solution_annealing = 'YES';
    derived.test_seismic = 'NO - default.';
    derived.calibration_certificate = 'Yes';
    derived.ibr_ce_certification = 'NO - default.';
    derived.design_validation_api6d = 'NO - default.';

    // ── STEP 10: Final Pressure Testing (Hydro Shell, Seat, Air & Back Seat) ─
    const hydro = HYDRO_TEST_PRESSURES[cls] || HYDRO_TEST_PRESSURES[150];
    derived.hydro_shell_pressure_psi = hydro.shell;
    derived.hydro_seat_pressure_psi = hydro.seat;
    derived.air_seat_pressure_psi = hydro.air; // 100 PSI for Globe Valve

    // Durations:
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

    derived.test_dbb_hydro = '-';
    // Back seat test is mandatory for Globe Valve: use Seat Test pressure and duration as per class & size
    derived.test_backseat = `Yes (Pressure: ${hydro.seat} PSI, Duration: ${derived.test_duration_seat_min})`;
    derived.test_back_seat = `Seat Test: ${hydro.seat} PSI / ${derived.test_duration_seat_min}`;
    derived.test_antistatic = 'No';
    derived.test_antistatic_test = 'No';

    // ── STEP 11: Painting, Dispatch & API 6D Annexures ────────────────────
    derived.painting_dft_micron = '120 (default)';
    derived.packing = 'Yes';
    derived.dispatch_by = 'Road (default)';
    derived.location = 'As Per client Req';
    derived.is_special_requirement = 'NO';

    // Annexures: Globe valves are manufactured per BS 1873 / ISO 15761, so all API 6D annexures are NO
    ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm'].forEach(letter => {
      derived[`annex_${letter}`] = 'No';
      derived[`api_6d_annex_${letter}`] = 'No';
    });

    return {
      success: true,
      valveType: 'Globe Valve',
      totalRulesEvaluated: 66,
      specifications: derived,
      conflicts,
      provenance: 'PETRO_STD_GLOBE_VALVE_ENGINE'
    };
  }
}

module.exports = new GlobeValveRulesEngine();

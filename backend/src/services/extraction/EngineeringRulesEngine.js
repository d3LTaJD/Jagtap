/**
 * EngineeringRulesEngine.js
 * Deterministic engineering derivation and contract review rule engine.
 * Derives valve design types, applicable standards, annexures, testing specifications,
 * and hydro/air test pressures based on validated engineering inputs.
 */

const { VALIDATION_STATES, REVIEW_REASONS } = require('../../types/EngineeringField');
const engineeringDictionary = require('./EngineeringDictionary');

// Hydrostatic & Air test pressure tables (PSI) per ASME B16.34 / API 6D / API 598
const HYDRO_TEST_PRESSURES = Object.freeze({
  150: { shell: 450, seat: 325, air: 100 },
  300: { shell: 1125, seat: 825, air: 100 },
  600: { shell: 2250, seat: 1650, air: 100 },
  800: { shell: 3050, seat: 2250, air: 100 },
  900: { shell: 3300, seat: 2450, air: 100 },
  1500: { shell: 5500, seat: 4050, air: 100 },
  2500: { shell: 9200, seat: 6700, air: 100 }
});

class EngineeringRulesEngine {
  /**
   * Calculates deterministic hydro and air test pressures and durations.
   * @param {string|number} valveClass Class rating (e.g. "150#", 150)
   * @param {string|number} valveSize Size in mm or inches (e.g. "50 mm", 50, '2"')
   * @param {string} valveType Valve type (e.g. "Ball Valve")
   * @param {string} testingStandard Testing standard (e.g. "API 6D", "API 598")
   * @returns {Object} Test parameters or DEFERRED state if inputs missing
   */
  calculateHydroAndAirTest(valveClass, valveSize, valveType = 'Ball Valve', testingStandard = null) {
    if (!valveClass || !valveSize) {
      return {
        shell: null,
        seat: null,
        air: null,
        validationState: VALIDATION_STATES.DEFERRED,
        needsManualReview: true,
        reviewReason: REVIEW_REASONS.MISSING_ENGINEERING_INPUT,
        reason: 'Missing valve size or pressure class required for hydro test calculation'
      };
    }

    const clsNum = parseInt(String(valveClass).replace(/[^0-9]/g, ''), 10);
    const szNum = parseInt(String(valveSize).replace(/[^0-9]/g, ''), 10);

    if (isNaN(clsNum) || !HYDRO_TEST_PRESSURES[clsNum]) {
      return {
        shell: null,
        seat: null,
        air: null,
        validationState: VALIDATION_STATES.NOT_FOUND,
        needsManualReview: true,
        reviewReason: REVIEW_REASONS.CLASS_NOT_FOUND,
        reason: `Pressure class "${valveClass}" is not in hydro test pressure tables`
      };
    }

    if (isNaN(szNum) || szNum < 15 || szNum > 2000) {
      return {
        shell: null,
        seat: null,
        air: null,
        validationState: VALIDATION_STATES.NOT_FOUND,
        needsManualReview: true,
        reviewReason: REVIEW_REASONS.SIZE_NOT_FOUND,
        reason: `Size "${valveSize}" is outside valid 15mm-2000mm hydro test range`
      };
    }

    const p = HYDRO_TEST_PRESSURES[clsNum];

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
      air: `100 (${seatDur})`,
      shellPressure: p.shell,
      seatPressure: p.seat,
      airPressure: 100,
      shellDurationMinutes: parseInt(shellDur, 10),
      seatDurationMinutes: parseInt(seatDur, 10),
      validationState: VALIDATION_STATES.VALID,
      provenance: 'ENGINEERING_RULE'
    };
  }

  /**
   * Evaluates deterministic Contract Review and Engineering Derivation rules for a line item.
   * @param {Object} spec Item specifications { valveType, valveSize, valveClass, customerTestingStd, description }
   * @returns {Object} Derived specifications and conflict logs
   */
  evaluateContractReviewRules(spec = {}) {
    const {
      valveType,
      valveSize,
      valveClass,
      customerTestingStd,
      description = ''
    } = spec;

    const derived = {};
    const conflicts = [];
    let needsManualReview = false;
    let reviewReason = null;

    const upperType = String(valveType || description).toUpperCase();
    const upperDesc = String(description).toUpperCase();

    // 1. Missing Size Guard: Cannot derive size-dependent rules
    const szNum = valveSize ? parseInt(String(valveSize).replace(/[^0-9]/g, ''), 10) : null;
    const clsNum = valveClass ? parseInt(String(valveClass).replace(/[^0-9]/g, ''), 10) : null;

    if (!valveSize || isNaN(szNum)) {
      return {
        derived: {},
        conflicts: [],
        validationState: VALIDATION_STATES.DEFERRED,
        needsManualReview: true,
        reviewReason: REVIEW_REASONS.MISSING_ENGINEERING_INPUT,
        reason: 'Valve size is unknown; cannot derive engineering rules'
      };
    }

    // Extract customer-specified component MOCs from description if present
    const descMocs = (function(text) {
      if (!text || typeof text !== 'string') return {};
      const clean = s => s ? s.replace(/^[\s:=–-]+/, '').replace(/[,;:\s]+$/, '').trim() : null;
      const body = text.match(/(?:body\s*(?:moc|material)|body)\s*[:=–-]?\s*([A-Za-z0-9\s\.\,\/\+\%\(\)\-]+?)(?=\s*[|\n]|\s*(?:ball|stem|seat|trim|disc|wedge|fasteners?|studs?|nuts?|end|size|class|qty|quantity|feature|paint|$))/i)?.[1];
      const ball = text.match(/(?:(?:ball|disc|wedge)\s*(?:moc|material)|(?:disc\/trim\s*moc))\s*[:=–-]?\s*([A-Za-z0-9\s\.\,\/\+\%\(\)\-]+?)(?=\s*[|\n]|\s*(?:body|stem|seat|trim|disc|wedge|fasteners?|studs?|nuts?|end|size|class|qty|quantity|feature|paint|$))/i)?.[1];
      const stem = text.match(/(?:stem\s*(?:moc|material))\s*[:=–-]?\s*([A-Za-z0-9\s\.\,\/\+\%\(\)\-]+?)(?=\s*[|\n]|\s*(?:body|ball|seat|trim|disc|wedge|fasteners?|studs?|nuts?|end|size|class|qty|quantity|feature|paint|$))/i)?.[1];
      const seat = text.match(/(?:seat(?:\s*ring)?\s*(?:moc|material))\s*[:=–-]?\s*([A-Za-z0-9\s\.\,\/\+\%\(\)\-]+?)(?=\s*[|\n]|\s*(?:body|ball|stem|trim|disc|wedge|fasteners?|studs?|nuts?|end|size|class|qty|quantity|feature|paint|$))/i)?.[1];
      const trim = text.match(/(?:trim\s*(?:moc|material))\s*[:=–-]?\s*([A-Za-z0-9\s\.\,\/\+\%\(\)\-]+?)(?=\s*[|\n]|\s*(?:body|ball|stem|seat|disc|wedge|fasteners?|studs?|nuts?|end|size|class|qty|quantity|feature|paint|$))/i)?.[1];
      const studs = text.match(/(?:(?:fasteners?|studs?\s*(?:&|and)\s*nuts?)\s*(?:moc|material)?)\s*[:=–-]?\s*([A-Za-z0-9\s\.\,\/\+\%\(\)\-]+?)(?=\s*[|\n]|\s*(?:body|ball|stem|seat|trim|disc|wedge|end|size|class|qty|quantity|feature|paint|$))/i)?.[1];
      return { 
        body: clean(body), 
        ball: clean(ball) || clean(trim), 
        stem: clean(stem), 
        seat: clean(seat), 
        trim: clean(trim), 
        studs: clean(studs) 
      };
    })(description);

    const inputBodyMoc = spec.bodyMoc || spec.body_moc || spec.valve_moc_body || spec.valve_body_moc || descMocs.body || null;
    const inputBallMoc = spec.ballMoc || spec.ball_moc || spec.valve_moc_ball || spec.valve_ball_moc || descMocs.ball || null;
    const inputStemMoc = spec.stemMoc || spec.stem_moc || spec.valve_moc_stem || spec.valve_stem_moc || descMocs.stem || null;
    const inputSeatMoc = spec.seatMoc || spec.seat_moc || spec.valve_moc_seat || spec.valve_seat_ring_moc || descMocs.seat || null;
    const inputTrimMoc = spec.trimMoc || spec.trim_moc || descMocs.trim || null;
    const inputStudsMoc = spec.studsMoc || spec.studs_moc || spec.valve_moc_stud_nuts || spec.valve_fasteners_moc || descMocs.studs || null;

    // 2. CHECK VALVES: Comprehensive 66-Point Petro Standard Derivation
    if (upperType.includes('CHECK') || upperType.includes('NRV') || upperDesc.includes('CHECK')) {
      const checkValveRulesEngine = require('./CheckValveRulesEngine');
      const cvResult = checkValveRulesEngine.deriveSpecifications({
        size: valveSize,
        valve_size: valveSize,
        class: valveClass,
        valve_class: valveClass,
        body_moc: inputBodyMoc,
        valve_moc_body: inputBodyMoc,
        ball_moc: inputBallMoc,
        trim_moc: inputTrimMoc || inputBallMoc,
        stem_moc: inputStemMoc,
        seat_moc: inputSeatMoc,
        studs_moc: inputStudsMoc,
        valve_fasteners_moc: inputStudsMoc,
        testing_std: customerTestingStd,
        description
      });

      if (cvResult && cvResult.specifications) {
        const cv = cvResult.specifications;
        derived.valve_design_type = cv.design_type; // "Lift" (15-40mm) or "Swing" (50mm+)
        derived.design_type = cv.design_type;
        derived.valve_ball_type = '-';
        derived.ball_type = '-';
        derived.valve_seat_type = cv.seat_type; // "Metal Seat"
        derived.seat_type = cv.seat_type;
        derived.valve_design_std = cv.valve_design_std;
        derived.valve_testing_std = cv.valve_testing_std;
        derived.valve_operating = '-';
        derived.valve_end_connection = cv.end_connection;
        derived.end_connection = cv.end_connection;
        derived.moc_seat = cv.moc_seat;
        derived.moc_body = cv.moc_body;
        derived.moc_ball = cv.moc_ball; // Disc
        derived.moc_stem = cv.moc_stem;
        derived.moc_stud_nuts = cv.moc_stud_nuts;
        derived.drain_conn_size = cv.drain_conn_size;
        derived.vent_conn_size = cv.vent_conn_size;
        derived.lifting_lug = cv.lifting_lug;
        derived.support_foot = cv.support_foot;
        derived.fire_safe_design = cv.fire_safe_design;
        derived.valve_antistatic_test = '-';
        derived.test_rt = cv.test_rt;
        derived.test_ut = cv.test_ut;
        derived.test_dpt = cv.test_dpt;
        derived.test_mpt = cv.test_mpt;
        derived.nace_requirement = cv.nace_requirement;
        derived.test_pmi = cv.test_pmi;
        derived.annex_c = cv.api_6d_annex_c;
        derived.annex_d = cv.api_6d_annex_d;
        derived.annex_e = cv.api_6d_annex_e;
        derived.annex_g = cv.api_6d_annex_g;
        derived.annex_h = cv.api_6d_annex_h;
        derived.api_6d_monogram = cv.api_6d_monogram;
        derived.qsl_level = cv.qsl_level;
        derived.bore = cv.bore;
        derived.painting_dft = cv.painting_dft_micron;
        derived.hydro_shell_psi = cv.hydro_shell_pressure_psi;
        derived.hydro_seat_psi = cv.hydro_seat_pressure_psi;
        derived.air_seat_psi = cv.air_seat_pressure_psi;
        derived.test_duration_shell = cv.test_duration_shell_min;
        derived.test_duration_seat = cv.test_duration_seat_min;
        derived.design_operating_pressure_max_temp = cv.design_operating_pressure_max_temp_psi;
        derived.design_operating_pressure_min_temp = cv.design_operating_pressure_min_temp_psi;
        derived.min_design_temp = cv.min_design_temp;
        derived.max_design_temp = cv.max_design_temp;
        derived.corrosion_allowance = cv.corrosion_allowance;
        derived.direction = 'Uni Directional';
      }
    }

    // 3. BALL VALVES: Comprehensive 66-Point Petro Standard Derivation
    else if (upperType.includes('BALL') || upperDesc.includes('BALL')) {
      const ballValveRulesEngine = require('./BallValveRulesEngine');
      const bvResult = ballValveRulesEngine.deriveSpecifications({
        size: valveSize,
        valve_size: valveSize,
        class: valveClass,
        valve_class: valveClass,
        body_moc: inputBodyMoc,
        valve_moc_body: inputBodyMoc,
        ball_moc: inputBallMoc,
        trim_moc: inputTrimMoc || inputBallMoc,
        stem_moc: inputStemMoc,
        seat_moc: inputSeatMoc,
        studs_moc: inputStudsMoc,
        valve_fasteners_moc: inputStudsMoc,
        testing_std: customerTestingStd,
        description
      });

      if (bvResult && bvResult.specifications) {
        const bv = bvResult.specifications;
        derived.valve_design_type = bv.design_type_pieces; // "2 p/c" or "3 p/c" as per Petro Std
        derived.design_type_pieces = bv.design_type_pieces;
        derived.valve_ball_type = bv.is_tmbv ? 'TMBV' : 'Floating'; // "Floating" or "TMBV"
        derived.ball_type = bv.ball_type;
        derived.valve_seat_type = bv.seat_type; // "Soft Seat" or "Primary Metal Secondary Soft"
        derived.seat_type = bv.seat_type;
        derived.valve_design_std = bv.valve_design_std;
        derived.valve_testing_std = bv.valve_testing_std;
        derived.valve_operating = bv.valve_operating;
        derived.valve_end_connection = bv.valve_end_connection || bv.end_connection;
        derived.end_connection = bv.end_connection;
        derived.moc_seat = bv.moc_seat;
        derived.moc_body = bv.moc_body;
        derived.moc_ball = bv.moc_ball;
        derived.moc_stem = bv.moc_stem;
        derived.moc_stud_nuts = bv.moc_stud_nuts;
        derived.drain_conn_size = bv.drain_conn_size;
        derived.vent_conn_size = bv.vent_conn_size;
        derived.lifting_lug = bv.lifting_lug;
        derived.support_foot = bv.support_foot;
        derived.fire_safe_design = bv.fire_safe_design;
        derived.valve_antistatic_test = 'Yes';
        derived.test_rt = bv.test_rt;
        derived.test_ut = bv.test_ut;
        derived.test_dpt = bv.test_dpt;
        derived.test_mpt = bv.test_mpt;
        derived.nace_requirement = bv.nace_requirement;
        derived.test_pmi = bv.test_pmi;
        derived.annex_c = bv.api_6d_annex_c;
        derived.annex_d = bv.api_6d_annex_d;
        derived.annex_e = bv.api_6d_annex_e;
        derived.annex_g = bv.api_6d_annex_g;
        derived.annex_h = bv.api_6d_annex_h;
        derived.api_6d_monogram = bv.api_6d_monogram;
        derived.qsl_level = bv.qsl_level;
        derived.bore = bv.bore;
        derived.painting_dft = bv.painting_dft_micron;
        derived.hydro_shell_psi = bv.hydro_shell_pressure_psi;
        derived.hydro_seat_psi = bv.hydro_seat_pressure_psi;
        derived.air_seat_psi = bv.air_seat_pressure_psi;
        derived.test_duration_shell = bv.test_duration_shell_min;
        derived.test_duration_seat = bv.test_duration_seat_min;
        derived.design_operating_pressure_max_temp = bv.design_operating_pressure_max_temp_psi;
        derived.design_operating_pressure_min_temp = bv.design_operating_pressure_min_temp_psi;
        derived.min_design_temp = bv.min_design_temp;
        derived.max_design_temp = bv.max_design_temp;
        derived.corrosion_allowance = bv.corrosion_allowance;
      }
    }

    // 4. GLOBE VALVES: Comprehensive 66-Point Petro Standard Derivation
    else if (upperType.includes('GLOBE') || upperDesc.includes('GLOBE')) {
      const globeValveRulesEngine = require('./GlobeValveRulesEngine');
      const gvResult = globeValveRulesEngine.deriveSpecifications({
        size: valveSize,
        valve_size: valveSize,
        class: valveClass,
        valve_class: valveClass,
        body_moc: inputBodyMoc,
        valve_moc_body: inputBodyMoc,
        ball_moc: inputBallMoc,
        trim_moc: inputTrimMoc || inputBallMoc,
        stem_moc: inputStemMoc,
        seat_moc: inputSeatMoc,
        studs_moc: inputStudsMoc,
        valve_fasteners_moc: inputStudsMoc,
        testing_std: customerTestingStd,
        description
      });

      if (gvResult && gvResult.specifications) {
        const gv = gvResult.specifications;
        derived.valve_design_type = gv.design_type; // "OS&Y"
        derived.design_type = gv.design_type;
        derived.valve_ball_type = gv.ball_type; // "Globe"
        derived.ball_type = gv.ball_type;
        derived.valve_seat_type = gv.seat_type; // "Metal Seat"
        derived.seat_type = gv.seat_type;
        derived.valve_design_std = gv.valve_design_std;
        derived.valve_testing_std = gv.valve_testing_std;
        derived.valve_operating = gv.valve_operating; // "Hand Wheel" vs "Gear Box"
        derived.valve_end_connection = gv.end_connection;
        derived.end_connection = gv.end_connection;
        derived.moc_seat = gv.moc_seat;
        derived.moc_body = gv.moc_body;
        derived.moc_ball = gv.moc_ball; // Disc (13% Cr Steel)
        derived.moc_stem = gv.moc_stem; // Stem (13% Cr Steel)
        derived.moc_stud_nuts = gv.moc_stud_nuts;
        derived.drain_conn_size = gv.drain_conn_size;
        derived.vent_conn_size = gv.vent_conn_size;
        derived.lifting_lug = gv.lifting_lug;
        derived.support_foot = gv.support_foot;
        derived.fire_safe_design = gv.fire_safe_design;
        derived.valve_antistatic_test = 'No';
        derived.test_rt = gv.test_rt;
        derived.test_ut = gv.test_ut;
        derived.test_dpt = gv.test_dpt;
        derived.test_mpt = gv.test_mpt;
        derived.nace_requirement = gv.nace_requirement;
        derived.test_pmi = gv.test_pmi;
        derived.annex_c = gv.api_6d_annex_c;
        derived.annex_d = gv.api_6d_annex_d;
        derived.annex_e = gv.api_6d_annex_e;
        derived.annex_g = gv.api_6d_annex_g;
        derived.annex_h = gv.api_6d_annex_h;
        derived.api_6d_monogram = gv.api_6d_monogram;
        derived.qsl_level = gv.qsl_level;
        derived.bore = gv.bore;
        derived.painting_dft = gv.painting_dft_micron;
        derived.hydro_shell_psi = gv.hydro_shell_pressure_psi;
        derived.hydro_seat_psi = gv.hydro_seat_pressure_psi;
        derived.air_seat_psi = gv.air_seat_pressure_psi;
        derived.test_duration_shell = gv.test_duration_shell_min;
        derived.test_duration_seat = gv.test_duration_seat_min;
        derived.design_operating_pressure_max_temp = gv.design_operating_pressure_max_temp_psi;
        derived.design_operating_pressure_min_temp = gv.design_operating_pressure_min_temp_psi;
        derived.min_design_temp = gv.min_design_temp;
        derived.max_design_temp = gv.max_design_temp;
        derived.corrosion_allowance = gv.corrosion_allowance;
        derived.direction = gv.direction;
        derived.test_backseat = gv.test_backseat;
      }
    }

    // 5. GATE VALVES
    else if (upperType.includes('GATE') || upperDesc.includes('GATE')) {
      derived.valve_design_type = szNum <= 40 ? 'Forged Gate Valve' : 'Wedge Gate Valve';
      derived.valve_design_std = szNum <= 40 ? 'API 602' : 'API 600';
      derived.valve_testing_std = 'API 598';
      derived.annex_e = 'No';
      derived.moc_body = inputBodyMoc || (clsNum === 800 ? 'ASTM A105' : 'ASTM A216 Gr. WCB');
      derived.moc_ball = inputBallMoc || inputTrimMoc || (clsNum === 800 ? '13% Cr Steel' : 'ASTM A216 Gr. WCB + STELLITED');
      derived.moc_stem = inputStemMoc || 'ASTM A479 Gr. 410';
      derived.moc_seat = inputSeatMoc || 'ASTM A216 Gr. WCB + STELLITED';
      derived.moc_stud_nuts = inputStudsMoc || 'ASTM A193 Gr. B7 & ASTM A194 Gr. 2H';
    }

    // Standardize all component MOC field aliases on derived object
    if (derived.moc_body) {
      derived.valve_moc_body = derived.moc_body;
      derived.valve_body_moc = derived.moc_body;
    }
    if (derived.moc_ball) {
      derived.valve_moc_ball = derived.moc_ball;
      derived.valve_ball_moc = derived.moc_ball;
    }
    if (derived.moc_stem) {
      derived.valve_moc_stem = derived.moc_stem;
      derived.valve_stem_moc = derived.moc_stem;
    }
    if (derived.moc_seat) {
      derived.valve_moc_seat = derived.moc_seat;
      derived.valve_seat_ring_moc = derived.moc_seat;
    }
    if (derived.moc_stud_nuts) {
      derived.valve_moc_stud_nuts = derived.moc_stud_nuts;
      derived.valve_fasteners_moc = derived.moc_stud_nuts;
    }

    // 6. CUSTOMER TESTING STANDARD CONFLICT DETECTION
    // If customer explicitly provided a testing standard that differs from the derived standard,
    // NEVER overwrite customer evidence — flag CONFLICT and preserve both.
    if (customerTestingStd && derived.valve_testing_std) {
      const custNorm = customerTestingStd.toUpperCase().replace(/\s+/g, ' ').trim();
      const derivedNorm = derived.valve_testing_std.toUpperCase().replace(/\s+/g, ' ').trim();

      if (custNorm !== derivedNorm) {
        conflicts.push({
          field: 'valve_testing_std',
          customerValue: customerTestingStd,
          derivedValue: derived.valve_testing_std,
          provenanceCustomer: 'CUSTOMER_EXTRACTED',
          provenanceDerived: 'ENGINEERING_RULE',
          validationState: VALIDATION_STATES.CONFLICT,
          reason: `Customer requested testing standard "${customerTestingStd}" differs from engineering rule default "${derived.valve_testing_std}"`
        });
        needsManualReview = true;
        reviewReason = REVIEW_REASONS.CUSTOMER_ENGINEERING_CONFLICT;
      }
    }

    return {
      derived,
      conflicts,
      validationState: conflicts.length > 0 ? VALIDATION_STATES.CONFLICT : VALIDATION_STATES.VALID,
      needsManualReview,
      reviewReason,
      provenance: 'ENGINEERING_RULE'
    };
  }

  evaluateCustomerOverrides(customerSpecs = {}, derivedSpecs = {}) {
    const custStd = customerSpecs.testing_standard || customerSpecs.valve_testing_std || null;
    const derStd = derivedSpecs.valve_testing_std || derivedSpecs.testing_standard || null;

    if (custStd && derStd) {
      const custNorm = custStd.toUpperCase().replace(/\s+/g, ' ').trim();
      const derNorm = derStd.toUpperCase().replace(/\s+/g, ' ').trim();
      if (custNorm !== derNorm) {
        return {
          hasConflict: true,
          field: 'valve_testing_std',
          customerValue: custStd,
          derivedValue: derStd,
          validationState: VALIDATION_STATES.CONFLICT,
          reviewReason: REVIEW_REASONS.CUSTOMER_ENGINEERING_CONFLICT
        };
      }
    }

    return {
      hasConflict: false,
      validationState: VALIDATION_STATES.VALID,
      reviewReason: null
    };
  }
}

module.exports = new EngineeringRulesEngine();

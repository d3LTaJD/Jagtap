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

    // 2. CHECK VALVES: Size-dependent design and standards
    if (upperType.includes('CHECK') || upperType.includes('NRV') || upperDesc.includes('CHECK')) {
      if (szNum <= 40) {
        derived.valve_design_type = 'Lift Check';
        derived.valve_design_std = 'BS 1868';
        derived.valve_testing_std = 'API 598';
      } else {
        derived.valve_design_type = 'Swing Check';
        derived.valve_design_std = 'API 6D';
        derived.valve_testing_std = 'API 6D';
      }
      derived.valve_antistatic_test = '-';
      derived.annex_e = 'No';
    }

    // 3. BALL VALVES: Design type (Floating vs Trunnion Mounted) & Annexures
    else if (upperType.includes('BALL') || upperDesc.includes('BALL')) {
      const isTmbv = upperType.includes('TRUNNION') || upperType.includes('TMBV') || upperDesc.includes('TRUNNION') || upperDesc.includes('TMBV');
      
      if (isTmbv) {
        derived.valve_design_type = 'Trunnion Mounted Ball Valve';
        derived.annex_e = 'Yes';
        derived.annex_c = 'Yes';
        derived.annex_d = 'Yes';
        derived.annex_g = 'Yes';
        derived.annex_h = 'Yes';
        derived.valve_antistatic_test = 'Yes';
        derived.valve_design_std = 'API 6D';
        derived.valve_testing_std = 'API 6D';
      } else {
        derived.valve_design_type = 'Floating Ball Valve';
        derived.annex_e = 'No';
        derived.annex_c = 'Yes';
        derived.annex_d = 'Yes';
        derived.annex_g = 'Yes';
        derived.annex_h = 'Yes';
        derived.valve_antistatic_test = 'Yes';
        derived.valve_design_std = 'API 6D';
        derived.valve_testing_std = 'API 6D';
      }
    }

    // 4. GLOBE VALVES: Painting DFT = 120
    else if (upperType.includes('GLOBE') || upperDesc.includes('GLOBE')) {
      derived.valve_design_type = 'Globe Valve';
      derived.valve_design_std = 'BS 1873';
      derived.valve_testing_std = 'API 598';
      derived.valve_painting_dft = '120';
      derived.annex_e = 'No';
    }

    // 5. GATE VALVES
    else if (upperType.includes('GATE') || upperDesc.includes('GATE')) {
      derived.valve_design_type = szNum <= 40 ? 'Forged Gate Valve' : 'Wedge Gate Valve';
      derived.valve_design_std = szNum <= 40 ? 'API 602' : 'API 600';
      derived.valve_testing_std = 'API 598';
      derived.annex_e = 'No';
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

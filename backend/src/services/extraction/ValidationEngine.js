/**
 * ValidationEngine.js
 * Executes 3-tier engineering, business catalog, and field compatibility validation.
 * Rejects impossible or hallucinated engineering values (e.g. Size 9000 mm or Class 3000).
 */

const { VALIDATION_STATES } = require('../../types/EngineeringField');
const engineeringDictionary = require('./EngineeringDictionary');

class ValidationEngine {
  /**
   * Validates an extracted value for a specific field using EngineeringDictionary.
   * @param {string} fieldId 
   * @param {any} value 
   * @returns {Object} { state: VALIDATION_STATES, reason: string, canonicalValue: any }
   */
  validateField(fieldId, value) {
    if (value === null || value === undefined || value === '') {
      return { state: VALIDATION_STATES.NOT_FOUND, reason: 'Value is empty', canonicalValue: null };
    }

    const res = engineeringDictionary.validateAndNormalize(fieldId, value);

    if (res.isValid) {
      return {
        state: VALIDATION_STATES.VALID,
        reason: res.reason,
        canonicalValue: res.canonicalValue
      };
    } else {
      return {
        state: VALIDATION_STATES.INVALID,
        reason: res.reason,
        canonicalValue: null
      };
    }
  }

  /**
   * Validation Gate: Validates normalized line item specifications against source specifications.
   * Flags missing or mismatching values for manual review without auto-filling magic defaults.
   * @param {Object} item 
   * @returns {Object} { isValid: boolean, warnings: string[], needsManualReview: boolean }
   */
  validateLineItem(item) {
    const warnings = [];
    let needsManualReview = false;

    const source = item.sourceSpecifications || {};
    const norm = item.normalizedSpecifications || {};
    const df = item.dynamicFields || {};

    const rawSize = source.sizeRaw || df.valve_size || '';
    const rawClass = source.pressureClassRaw || df.valve_class || '';

    // Gate 1: Flag missing size
    if (!norm.size || (norm.size.nps === null && norm.size.dn === null && !rawSize)) {
      warnings.push(`Line item ${item.enquirySrNo || ''}: Missing valve size specification`);
      needsManualReview = true;
    }

    // Gate 2: Flag missing pressure class
    if (!norm.pressureClass && !rawClass) {
      warnings.push(`Line item ${item.enquirySrNo || ''}: Missing pressure class specification`);
      needsManualReview = true;
    }

    // Gate 3: Flag mismatch between raw text size and normalized size
    if (rawSize && norm.size && norm.size.dn) {
      const matchNum = rawSize.match(/(\d+)/);
      if (matchNum) {
        const numInRaw = parseInt(matchNum[1], 10);
        if (numInRaw !== norm.size.dn && numInRaw !== norm.size.nps) {
          warnings.push(`Line item ${item.enquirySrNo || ''}: Size mismatch between raw text "${rawSize}" and normalized size ${norm.size.dn}mm`);
          needsManualReview = true;
        }
      }
    }

    return {
      isValid: warnings.length === 0,
      warnings,
      needsManualReview
    };
  }
}

module.exports = new ValidationEngine();

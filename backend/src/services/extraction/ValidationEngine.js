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
}

module.exports = new ValidationEngine();

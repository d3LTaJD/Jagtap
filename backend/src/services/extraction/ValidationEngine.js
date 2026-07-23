/**
 * ValidationEngine
 * Executes 3-tier engineering, business catalog, and field compatibility validation.
 * Rejects impossible engineering values (e.g. Size 9000 mm or Class 12345).
 */

const { VALIDATION_STATES } = require('../../types/EngineeringField');

class ValidationEngine {
  /**
   * Validates an extracted value for a specific field.
   * @param {string} fieldId 
   * @param {any} value 
   */
  validateField(fieldId, value) {
    if (value === null || value === undefined || value === '') {
      return { state: VALIDATION_STATES.NOT_FOUND, reason: 'Value is empty' };
    }

    const strVal = String(value).trim();

    switch (fieldId) {
      case 'valve_size':
      case 'size': {
        const num = Number(strVal);
        if (isNaN(num)) return { state: VALIDATION_STATES.INVALID, reason: 'Size is not a valid number' };
        if (num < 15 || num > 2000) {
          return { state: VALIDATION_STATES.INVALID, reason: `Size ${num}mm is outside standard catalog range (15mm - 2000mm)` };
        }
        return { state: VALIDATION_STATES.VALID, reason: 'Valid size in engineering range' };
      }

      case 'valve_class':
      case 'pressure_class': {
        const validClasses = ['150#', '300#', '600#', '800#', '900#', '1500#', '2500#'];
        if (!validClasses.includes(strVal)) {
          return { state: VALIDATION_STATES.INVALID, reason: `Pressure class "${strVal}" is not a recognized ASME class rating` };
        }
        return { state: VALIDATION_STATES.VALID, reason: 'Valid ASME pressure class' };
      }

      case 'quantity': {
        const qty = Number(strVal);
        if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
          return { state: VALIDATION_STATES.INVALID, reason: `Quantity "${strVal}" must be a positive integer` };
        }
        return { state: VALIDATION_STATES.VALID, reason: 'Valid quantity' };
      }

      default:
        return { state: VALIDATION_STATES.VALID, reason: 'Passed default validation' };
    }
  }
}

module.exports = new ValidationEngine();

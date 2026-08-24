/**
 * ValidationEngine.js
 * Executes 3-tier engineering, business catalog, and field compatibility validation.
 * Rejects impossible or hallucinated engineering values (e.g. Size 9000 mm or Class 3000).
 */

const { VALIDATION_STATES, REVIEW_REASONS } = require('../../types/EngineeringField');
const engineeringDictionary = require('./EngineeringDictionary');

class ValidationEngine {
  /**
   * Validates an extracted value for a specific field using EngineeringDictionary.
   * @param {string} fieldId 
   * @param {any} value 
   * @returns {Object} { state: VALIDATION_STATES, reason: string, canonicalValue: any, reviewReason: string|null, nps: any, dn: any }
   */
  validateField(fieldId, value) {
    if (value === null || value === undefined || value === '') {
      return {
        state: VALIDATION_STATES.NOT_FOUND,
        reason: 'Value is empty',
        canonicalValue: null,
        reviewReason: REVIEW_REASONS.MISSING_REQUIRED_FIELD
      };
    }

    const res = engineeringDictionary.validateAndNormalize(fieldId, value);

    return {
      state: res.state || (res.isValid ? VALIDATION_STATES.VALID : VALIDATION_STATES.INVALID),
      reason: res.reason,
      canonicalValue: res.canonicalValue,
      reviewReason: res.reviewReason || (res.isValid ? null : REVIEW_REASONS.INVALID_VALUE),
      nps: res.nps || null,
      dn: res.dn || null,
      isValid: res.isValid
    };
  }

  /**
   * Validation Gate: Validates normalized line item specifications against source specifications.
   * Flags missing or mismatching values for manual review without auto-filling magic defaults.
   * @param {Object} item 
   * @returns {Object} { isValid: boolean, warnings: string[], needsManualReview: boolean, reviewReasons: string[], reviewReason: string|null }
   */
  validateLineItem(item) {
    const warnings = [];
    const reviewReasons = [];
    let needsManualReview = false;

    const source = item.sourceSpecifications || {};
    const norm = item.normalizedSpecifications || {};
    const df = item.dynamicFields || {};

    const rawSize = source.sizeRaw || df.valve_size || '';
    const rawClass = source.pressureClassRaw || df.valve_class || '';

    // Gate 1: Flag missing or invalid quantity
    if (item.quantity === null || item.quantity === undefined || item.quantity <= 0 || !Number.isInteger(Number(item.quantity))) {
      warnings.push(`Line item ${item.lineItemId || item.enquirySrNo || ''}: Missing or invalid quantity specification`);
      reviewReasons.push(REVIEW_REASONS.MISSING_QUANTITY);
      needsManualReview = true;
    }

    // Gate 2: Flag missing size
    if (!norm.size || (norm.size.nps === null && norm.size.dn === null && !rawSize)) {
      warnings.push(`Line item ${item.lineItemId || item.enquirySrNo || ''}: Missing valve size specification`);
      reviewReasons.push(REVIEW_REASONS.SIZE_NOT_FOUND);
      needsManualReview = true;
    }

    // Gate 3: Flag missing pressure class
    if (!norm.pressureClass && !rawClass) {
      warnings.push(`Line item ${item.lineItemId || item.enquirySrNo || ''}: Missing pressure class specification`);
      reviewReasons.push(REVIEW_REASONS.CLASS_NOT_FOUND);
      needsManualReview = true;
    }

    // Gate 4: Validate size if present
    if (rawSize) {
      const sizeVal = this.validateField('valve_size', rawSize);
      if (sizeVal.state === VALIDATION_STATES.CONFLICT) {
        warnings.push(`Line item ${item.lineItemId || item.enquirySrNo || ''}: ${sizeVal.reason}`);
        reviewReasons.push(REVIEW_REASONS.SIZE_NPS_DN_MISMATCH);
        needsManualReview = true;
      } else if (sizeVal.state === VALIDATION_STATES.NOT_FOUND || !sizeVal.isValid) {
        warnings.push(`Line item ${item.lineItemId || item.enquirySrNo || ''}: ${sizeVal.reason}`);
        reviewReasons.push(REVIEW_REASONS.SIZE_NOT_FOUND);
        needsManualReview = true;
      }
    }

    // Gate 5: Validate class if present
    if (rawClass) {
      const classVal = this.validateField('valve_class', rawClass);
      if (classVal.state === VALIDATION_STATES.NOT_FOUND || !classVal.isValid) {
        warnings.push(`Line item ${item.lineItemId || item.enquirySrNo || ''}: ${classVal.reason}`);
        reviewReasons.push(REVIEW_REASONS.CLASS_NOT_FOUND);
        needsManualReview = true;
      }
    }

    // Gate 6: Flag mismatch between raw text size and normalized size
    if (rawSize && norm.size && norm.size.dn) {
      const parsedRawSize = engineeringDictionary.normalizeSize(rawSize);
      if (parsedRawSize.isValid && parsedRawSize.dn) {
        if (parsedRawSize.dn !== norm.size.dn) {
          warnings.push(`Line item ${item.lineItemId || item.enquirySrNo || ''}: Size mismatch between raw text "${rawSize}" (${parsedRawSize.dn}mm) and normalized size ${norm.size.dn}mm`);
          reviewReasons.push(REVIEW_REASONS.SIZE_CLASS_MISMATCH);
          needsManualReview = true;
        }
      } else {
        const matchNum = String(rawSize).match(/(\d+)/);
        if (matchNum) {
          const numInRaw = parseInt(matchNum[1], 10);
          if (numInRaw !== norm.size.dn && numInRaw !== norm.size.nps) {
            warnings.push(`Line item ${item.lineItemId || item.enquirySrNo || ''}: Size mismatch between raw text "${rawSize}" and normalized size ${norm.size.dn}mm`);
            reviewReasons.push(REVIEW_REASONS.SIZE_CLASS_MISMATCH);
            needsManualReview = true;
          }
        }
      }
    }

    return {
      isValid: warnings.length === 0,
      warnings,
      needsManualReview,
      reviewReasons,
      reviewReason: reviewReasons[0] || null
    };
  }
}

module.exports = new ValidationEngine();

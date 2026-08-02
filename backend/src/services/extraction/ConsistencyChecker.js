/**
 * ConsistencyChecker.js
 * Document-level consistency validation.
 * When multiple representations of the same field are found in a document
 * (e.g. 4", 100 mm, DN100 all meaning the same size), verifies they resolve
 * to the same canonical value. Flags inconsistencies for review.
 */

const engineeringDictionary = require('./EngineeringDictionary');

class ConsistencyChecker {
  /**
   * Checks document-level consistency across all size representations found.
   * @param {string} textContext Full document text
   * @returns {Object} { isConsistent: boolean, conflicts: Array, resolvedValues: Object }
   */
  checkConsistency(textContext) {
    if (!textContext || typeof textContext !== 'string') {
      return { isConsistent: true, conflicts: [], resolvedValues: {} };
    }

    const conflicts = [];
    const resolvedValues = {};

    // Check SIZE consistency
    const sizeConflicts = this._checkSizeConsistency(textContext);
    if (sizeConflicts.length > 0) conflicts.push(...sizeConflicts);
    if (sizeConflicts.length === 0) {
      const sizeMatches = this._extractAllSizes(textContext);
      if (sizeMatches.length > 0) resolvedValues.valve_size = sizeMatches[0].canonical;
    }

    // Check CLASS consistency
    const classConflicts = this._checkClassConsistency(textContext);
    if (classConflicts.length > 0) conflicts.push(...classConflicts);

    // Check VALVE TYPE consistency
    const typeConflicts = this._checkValveTypeConsistency(textContext);
    if (typeConflicts.length > 0) conflicts.push(...typeConflicts);

    return {
      isConsistent: conflicts.length === 0,
      conflicts,
      resolvedValues
    };
  }

  _extractAllSizes(text) {
    const sizePatterns = [
      /\b(\d+(?:\/\d+)?)\s*(?:"|inch|inches|in)\b/gi,
      /\bDN\s*(\d+)\b/gi,
      /\b(\d+)\s*mm\b/gi,
      /\bNPS\s*(\d+(?:\.\d+)?)\b/gi
    ];

    const found = [];
    for (const pattern of sizePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const raw = match[0].trim();
        const res = engineeringDictionary.validateAndNormalize('valve_size', match[1]);
        if (res.isValid && res.canonicalValue) {
          found.push({ raw, canonical: res.canonicalValue });
        }
      }
    }
    return found;
  }

  _checkSizeConsistency(text) {
    const allSizes = this._extractAllSizes(text);
    if (allSizes.length <= 1) return [];

    const canonicals = [...new Set(allSizes.map(s => s.canonical))];
    if (canonicals.length <= 1) return [];

    return [{
      field: 'valve_size',
      type: 'MULTI_ITEM_SIZES',
      message: `Detected multiple normalized sizes across enquiry (expected for multi-line BOQ): ${allSizes.map(s => `"${s.raw}" → ${s.canonical}`).join(', ')}`,
      values: allSizes,
      canonicals
    }];
  }

  _checkClassConsistency(text) {
    const classPattern = /\b(?:class|cl|cl\.)\s*(\d+)\s*(?:#|lbs)?\b/gi;
    const found = [];
    let match;
    while ((match = classPattern.exec(text)) !== null) {
      const res = engineeringDictionary.validateAndNormalize('valve_class', match[1]);
      if (res.isValid && res.canonicalValue) {
        found.push({ raw: match[0].trim(), canonical: res.canonicalValue });
      }
    }

    if (found.length <= 1) return [];
    const canonicals = [...new Set(found.map(f => f.canonical))];
    if (canonicals.length <= 1) return [];

    return [{
      field: 'valve_class',
      type: 'MULTI_ITEM_CLASSES',
      message: `Detected multiple pressure classes across enquiry (expected for multi-line BOQ): ${found.map(f => `"${f.raw}" → ${f.canonical}`).join(', ')}`,
      values: found,
      canonicals
    }];
  }

  _checkValveTypeConsistency(text) {
    const typePattern = /\b(ball|gate|globe|check|butterfly|plug|control|needle|safety)\s*valve\b/gi;
    const found = [];
    let match;
    while ((match = typePattern.exec(text)) !== null) {
      const res = engineeringDictionary.validateAndNormalize('valve_type', match[0]);
      if (res.isValid && res.canonicalValue) {
        found.push({ raw: match[0].trim(), canonical: res.canonicalValue });
      }
    }

    if (found.length <= 1) return [];
    const canonicals = [...new Set(found.map(f => f.canonical))];
    if (canonicals.length <= 1) return [];

    return [{
      field: 'valve_type',
      type: 'MULTI_ITEM_VALVE_TYPES',
      message: `Detected multiple valve types across enquiry (expected for multi-line BOQ): ${found.map(f => `"${f.raw}" → ${f.canonical}`).join(', ')}`,
      values: found,
      canonicals
    }];
  }
}

module.exports = new ConsistencyChecker();

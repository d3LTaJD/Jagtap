/**
 * Centralized Engineering Knowledge Engine
 * Delegates lookups and normalization to EngineeringDictionary as single source of truth.
 */

const engineeringDictionary = require('./EngineeringDictionary');

class KnowledgeEngine {
  constructor() {
    this.engineeringDictionary = engineeringDictionary;
  }

  normalizeSize(rawSize) {
    if (!rawSize) return null;
    const res = engineeringDictionary.validateAndNormalize('valve_size', rawSize);
    return res.isValid ? res.canonicalValue : null;
  }

  normalizeSizeDetailed(rawSize) {
    if (!rawSize) return { isValid: false, canonicalValue: null, nps: null, dn: null };
    return engineeringDictionary.normalizeSize(rawSize);
  }

  normalizeEndConnection(rawConn) {
    if (!rawConn) return null;
    const res = engineeringDictionary.validateAndNormalize('endConnection', rawConn);
    return res.isValid ? res.canonicalValue : null;
  }

  normalizeClass(rawClass) {
    if (!rawClass) return null;
    const res = engineeringDictionary.validateAndNormalize('valve_class', rawClass);
    return res.isValid ? res.canonicalValue : null;
  }

  normalizeMaterial(rawMat) {
    if (!rawMat) return null;
    const res = engineeringDictionary.validateAndNormalize('shellMaterial', rawMat);
    return res.isValid ? res.canonicalValue : null;
  }

  normalizeValveType(rawType) {
    if (!rawType) return null;
    const res = engineeringDictionary.validateAndNormalize('valve_type', rawType);
    return res.isValid ? res.canonicalValue : null;
  }

  normalizeQuantity(rawQty) {
    if (rawQty === null || rawQty === undefined) return null;
    const res = engineeringDictionary.validateAndNormalize('quantity', rawQty);
    return res.isValid ? parseInt(res.canonicalValue, 10) : null;
  }

  validateField(fieldName, rawValue) {
    return engineeringDictionary.validateAndNormalize(fieldName, rawValue);
  }

  registerLearnedAlias(category, alias, canonicalValue) {
    engineeringDictionary.registerLearnedAlias(category, alias, canonicalValue);
  }
}

// Export singleton instance
module.exports = new KnowledgeEngine();

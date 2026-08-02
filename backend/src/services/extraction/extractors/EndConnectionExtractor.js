/**
 * EndConnectionExtractor Plugin
 * Deterministically extracts Valve End Connections using regex patterns.
 */

const { createEngineeringField, VALIDATION_STATES } = require('../../../types/EngineeringField');
const engineeringDictionary = require('../EngineeringDictionary');

class EndConnectionExtractor {
  constructor() {
    this.id = 'EndConnectionExtractor';
  }

  extract(textContext) {
    if (!textContext || typeof textContext !== 'string') return null;

    const pattern = /\b(butt\s*weld|socket\s*weld|b\/w|s\/w|bw|sw|flanged|flange|fe|npt|threaded|screwed|rtj|ring\s*type\s*joint|raised\s*face|rf|flat\s*face|ff|wafer|lug)\b/i;
    const match = textContext.match(pattern);

    if (match && match[1]) {
      const rawValue = match[1].trim();
      const res = engineeringDictionary.validateAndNormalize('endConnection', rawValue);
      if (res.isValid && res.canonicalValue) {
        return createEngineeringField({
          fieldId: 'endConnection',
          fieldName: 'End Connection',
          rawValue,
          normalizedValue: res.canonicalValue,
          extractor: this.id,
          score: {
            confidence: 100,
            authority: 95,
            agreement: 100,
            validation: 100,
            completeness: 100,
            risk: 'LOW'
          },
          validationState: VALIDATION_STATES.VALID,
          reasoning: [`Regex matched end connection pattern: ${pattern.toString()}`]
        });
      }
    }

    return null;
  }
}

module.exports = new EndConnectionExtractor();

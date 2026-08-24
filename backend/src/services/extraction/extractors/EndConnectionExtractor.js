/**
 * EndConnectionExtractor Plugin
 * Deterministically extracts Valve End Connections with negation filtering
 * and ambiguity detection.
 */

const { createEngineeringField, VALIDATION_STATES, REVIEW_REASONS } = require('../../../types/EngineeringField');
const engineeringDictionary = require('../EngineeringDictionary');
const negationDetector = require('../NegationDetector');

class EndConnectionExtractor {
  constructor() {
    this.id = 'EndConnectionExtractor';
  }

  extract(textContext) {
    if (!textContext || typeof textContext !== 'string') return null;

    const pattern = /\b(butt\s*weld|socket\s*weld|b\/w|s\/w|bw|sw|flanged\s*raised\s*face|flanged\s*ring\s*type\s*joint|flanged\s*flat\s*face|flanged\s*rtj|flanged\s*rf|flanged\s*ff|flanged|flange|fe|npt|threaded|screwed|rtj|ring\s*type\s*joint|raised\s*face|rf|flat\s*face|ff|wafer|lug)\b/i;
    const match = textContext.match(pattern);

    if (match && match[1]) {
      const matchIndex = match.index;
      const rawValue = match[1].trim();

      // Check for negation (e.g. "Flanged connection is NOT permitted", "Socket Weld excluded")
      const negCheck = negationDetector.isNegated(textContext, matchIndex, match[0].length);
      if (negCheck.isNegated) {
        return createEngineeringField({
          fieldId: 'endConnection',
          fieldName: 'End Connection',
          rawValue,
          normalizedValue: null,
          extractor: this.id,
          score: {
            confidence: 0,
            authority: 90,
            agreement: 100,
            validation: 0,
            completeness: 0,
            risk: 'HIGH'
          },
          validationState: VALIDATION_STATES.INVALID,
          reviewReason: REVIEW_REASONS.RULE_VIOLATION,
          reasoning: [`End connection negated: ${negCheck.reason}`]
        });
      }

      const res = engineeringDictionary.validateAndNormalize('endConnection', rawValue);
      if (res.isValid && res.canonicalValue) {
        // Check for ambiguity (e.g. "Flanged or Butt Weld")
        const ambCheck = negationDetector.isAmbiguous(textContext, ['flanged', 'butt weld', 'socket weld', 'threaded', 'wafer', 'lug'], matchIndex, match[0].length);
        if (ambCheck.isAmbiguous) {
          return createEngineeringField({
            fieldId: 'endConnection',
            fieldName: 'End Connection',
            rawValue,
            normalizedValue: null,
            extractor: this.id,
            score: {
              confidence: 50,
              authority: 80,
              agreement: 50,
              validation: 50,
              completeness: 0,
              risk: 'MEDIUM'
            },
            validationState: VALIDATION_STATES.AMBIGUOUS,
            reviewReason: REVIEW_REASONS.MULTIPLE_MATCHES,
            reasoning: [`End connection ambiguous: ${ambCheck.reason}`]
          });
        }

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

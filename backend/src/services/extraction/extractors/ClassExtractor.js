/**
 * ClassExtractor Plugin
 * Deterministically extracts Valve Class / Pressure Rating with context validation
 * and non-pressure/negation filtering.
 */

const { createEngineeringField, VALIDATION_STATES, REVIEW_REASONS } = require('../../../types/EngineeringField');
const knowledgeEngine = require('../KnowledgeEngine');
const negationDetector = require('../NegationDetector');

class ClassExtractor {
  constructor() {
    this.id = 'ClassExtractor';
  }

  extract(textContext) {
    if (!textContext || typeof textContext !== 'string') return null;

    // Ordered patterns: Explicit pressure class prefixes first, then bounded class notations
    const patterns = [
      /\b(?:pressure\s*class|class|rating|cl)\s*[:=]?\s*([0-9]+#?)\b/i,
      /\bcl\s*[-]?\s*([0-9]+)\b/i,
      /\bclass\s*-\s*([0-9]+)\b/i,
      /\b([0-9]+)#\b/,
      /\b([0-9]+)\s*(?:lbs|lb)\b/i,
      /(?:^|[\s,;/-])(150|300|400|600|800|900|1500|2500)(?:#|\b|[\s,;/-])/i,
      /\b(?:[0-9]+(?:\/[0-9]+)?(?:\.[0-9]+)?\s*(?:"|inch|inches|in|nb|mm)|dn\s*[0-9]+)\s+([0-9]{3,4})\b/i,
      /\b(150|300|400|600|800|900|1500|2500)\s+(?:manual|gear|lever|handwheel|actuated|flanged|wcb|cf8m|rf|rtj|sw|bw|valve|ball|gate|globe|check)\b/i
    ];

    for (const pattern of patterns) {
      const match = textContext.match(pattern);
      if (match && match[1]) {
        const matchIndex = match.index;
        const rawValue = match[1].trim();

        // Check if preceding context indicates an unrelated metric (temperature, weight, length)
        const prefixContext = textContext.substring(Math.max(0, matchIndex - 25), matchIndex).toLowerCase();
        if (/\b(?:temp|temperature|deg|weight|qty|quantity|count|drawing|dwg|tag|item|no)\s*[:=]?\s*$/i.test(prefixContext)) {
          continue;
        }

        // Check for negation (e.g. "Class 300 not permitted", "without 300#")
        const negCheck = negationDetector.isNegated(textContext, matchIndex, match[0].length);
        if (negCheck.isNegated) {
          return createEngineeringField({
            fieldId: 'valve_class',
            fieldName: 'Pressure Class',
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
            reasoning: [`Pressure class negated: ${negCheck.reason}`]
          });
        }

        const normalizedValue = knowledgeEngine.normalizeClass(rawValue);
        if (normalizedValue) {
          // Check for ambiguity (e.g. "150# or 300# alternative")
          const ambCheck = negationDetector.isAmbiguous(textContext, [rawValue], matchIndex, match[0].length);
          if (ambCheck.isAmbiguous) {
            return createEngineeringField({
              fieldId: 'valve_class',
              fieldName: 'Pressure Class',
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
              reasoning: [`Pressure class ambiguous: ${ambCheck.reason}`]
            });
          }

          return createEngineeringField({
            fieldId: 'valve_class',
            fieldName: 'Pressure Class',
            rawValue,
            normalizedValue,
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
            reasoning: [`Regex matched class pattern: ${pattern.toString()}`]
          });
        }
      }
    }

    return null;
  }
}

module.exports = new ClassExtractor();

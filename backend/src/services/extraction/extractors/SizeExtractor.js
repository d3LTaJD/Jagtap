/**
 * SizeExtractor Plugin
 * Deterministically extracts Valve Size (DN / Inches / mm) with context validation
 * and non-equipment / negation filtering.
 */

const { createEngineeringField, VALIDATION_STATES, REVIEW_REASONS } = require('../../../types/EngineeringField');
const knowledgeEngine = require('../KnowledgeEngine');
const negationDetector = require('../NegationDetector');

class SizeExtractor {
  constructor() {
    this.id = 'SizeExtractor';
  }

  extract(textContext) {
    if (!textContext || typeof textContext !== 'string') return null;

    // Ordered patterns: Strong structured patterns first, then contextual patterns
    const patterns = [
      /\b(?:valve\s*size|size|nps|dn)\s*[:=]?\s*([0-9\/\. -]+(?:"|inch|inches|nb|in|mm)?)(?=\s|$|[,;/-])/i,
      /\b(dn\s*[0-9]+)\b/i,
      /\b(nps\s*[0-9]+(?:\/[0-9]+)?)\b/i,
      /\b([0-9]+(?:\/[0-9]+)?(?:\.[0-9]+)?\s*(?:"|inch|inches|in|nb|mm))(?=\s|$|[,;/-]|[a-zA-Z#])/i,
      /\b([0-9]+\/[0-9]+"|[0-9\.]+")(?=\s|$|[,;/-]|[a-zA-Z#])/i,
      /\b([0-9]+(?:\/[0-9]+)?(?:\.[0-9]+)?\s*(?:"|inch|in|nb|mm)?)\s*x\s*(?:ansi|class|#|api|[0-9]+#)\b/i,
      /\b([0-9]+\s*mm)\b/i,
      /\b([0-9]+\s*nb)\b/i
    ];

    for (const pattern of patterns) {
      const match = textContext.match(pattern);
      if (match && match[1]) {
        const matchIndex = match.index;
        const rawValue = match[1].trim();

        // 1. Check if this size belongs to non-valve equipment (gasket, flange, pipe, bolt)
        const nonValveCheck = negationDetector.isNonValveEquipmentContext(textContext, matchIndex);
        if (nonValveCheck.isNonValve) {
          // Skip non-valve equipment sizes (e.g. "Gasket: 4 inch", "Flange: DN100")
          continue;
        }

        // 2. Check for negation (e.g. "Size: 4 inch not required", "without 100mm")
        const negCheck = negationDetector.isNegated(textContext, matchIndex, match[0].length);
        if (negCheck.isNegated) {
          return createEngineeringField({
            fieldId: 'valve_size',
            fieldName: 'Valve Size (DN)',
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
            reasoning: [`Size negated: ${negCheck.reason}`]
          });
        }

        // 3. Normalize size
        const normalizedValue = knowledgeEngine.normalizeSize(rawValue);
        if (normalizedValue) {
          // Check for ambiguity (e.g. "2 inch or 4 inch alternative")
          const ambCheck = negationDetector.isAmbiguous(textContext, [rawValue], matchIndex, match[0].length);
          if (ambCheck.isAmbiguous) {
            return createEngineeringField({
              fieldId: 'valve_size',
              fieldName: 'Valve Size (DN)',
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
              reasoning: [`Size ambiguous: ${ambCheck.reason}`]
            });
          }

          return createEngineeringField({
            fieldId: 'valve_size',
            fieldName: 'Valve Size (DN)',
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
            reasoning: [`Regex matched pattern: ${pattern.toString()}`]
          });
        }
      }
    }

    return null;
  }
}

module.exports = new SizeExtractor();

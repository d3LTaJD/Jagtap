/**
 * SizeExtractor Plugin
 * Deterministically extracts Valve Size (DN / Inches / mm) using regex patterns.
 */

const { createEngineeringField, VALIDATION_STATES } = require('../../../types/EngineeringField');
const knowledgeEngine = require('../KnowledgeEngine');

class SizeExtractor {
  constructor() {
    this.id = 'SizeExtractor';
  }

  extract(textContext) {
    if (!textContext || typeof textContext !== 'string') return null;

    // Regex patterns for valve sizes
    const patterns = [
      /\b(?:size|dn|nps)\s*[:=]?\s*([0-9\/\. -]+(?:"|inch|inches|nb|in|mm)?)\b/i,
      /\b([0-9]+(?:\/[0-9]+)?(?:\.[0-9]+)?)\s*(?:"|inch|inches|in|nb|mm)\b/i,
      /\b([0-9]+\/[0-9]+"|[0-9\.]+")\s*(?:ball|globe|gate|check|valve)?\b/i,
      /\b([0-9]+(?:\/[0-9]+)?(?:\.[0-9]+)?)\s*x\s*(?:ansi|class|#|api)\b/i,
      /\bdn\s*([0-9]+)\b/i,
      /\b([0-9]+)\s*mm\b/i
    ];

    for (const pattern of patterns) {
      const match = textContext.match(pattern);
      if (match && match[1]) {
        const rawValue = match[1].trim();
        const normalizedValue = knowledgeEngine.normalizeSize(rawValue);
        if (normalizedValue) {
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

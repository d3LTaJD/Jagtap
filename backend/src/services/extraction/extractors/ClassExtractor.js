/**
 * ClassExtractor Plugin
 * Deterministically extracts Valve Class / Pressure Rating using regex patterns.
 */

const { createEngineeringField, VALIDATION_STATES } = require('../../../types/EngineeringField');
const knowledgeEngine = require('../KnowledgeEngine');

class ClassExtractor {
  constructor() {
    this.id = 'ClassExtractor';
  }

  extract(textContext) {
    if (!textContext || typeof textContext !== 'string') return null;

    const patterns = [
      /\b(?:class|cl|rating)\s*[:=]?\s*([0-9]+#?)/i,
      /\b([0-9]+)#/i,
      /\bclass\s*-\s*([0-9]+)/i,
      /\b([0-9]+)\s*(?:lbs|lb)\b/i
    ];

    for (const pattern of patterns) {
      const match = textContext.match(pattern);
      if (match && match[1]) {
        const rawValue = match[1].trim();
        const normalizedValue = knowledgeEngine.normalizeClass(rawValue);
        if (normalizedValue) {
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

/**
 * ValveExtractor Plugin
 * Deterministically extracts Valve Type using regex patterns.
 */

const { createEngineeringField, VALIDATION_STATES } = require('../../../types/EngineeringField');
const knowledgeEngine = require('../KnowledgeEngine');

class ValveExtractor {
  constructor() {
    this.id = 'ValveExtractor';
  }

  extract(textContext) {
    if (!textContext || typeof textContext !== 'string') return null;

    const pattern = /\b(ball\s+valve|globe\s+valve|gate\s+valve|check\s+valve|non\s+return\s+valve|butterfly\s+valve|plug\s+valve|control\s+valve|nrv|bfv)\b/i;
    const match = textContext.match(pattern);

    if (match && match[1]) {
      const rawValue = match[1].trim();
      const normalizedValue = knowledgeEngine.normalizeValveType(rawValue);
      if (normalizedValue) {
        return createEngineeringField({
          fieldId: 'valve_type',
          fieldName: 'Valve Type',
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
          reasoning: [`Regex matched valve type pattern: ${pattern.toString()}`]
        });
      }
    }

    return null;
  }
}

module.exports = new ValveExtractor();

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

    const patterns = [
      // Standard patterns
      /\b(ball\s+valve|globe\s+valve|gate\s+valve|check\s+valve|non\s+return\s+valve|butterfly\s+valve|plug\s+valve|control\s+valve|nrv|bfv)\b/i,
      /\b(ball|gate|globe|check|butterfly|plug|control)\b(?=\s+(?:valve|api|trunnion|class|cl|\d+in|\d+"))/i,
      // BOQ shorthand: "BALL API6D", "GATE API600", "CHECK API6D"
      /\b(ball|gate|globe|check|butterfly|plug)\b\s+(?:api\s*\d+|ansi|asme)/i,
      // Comma-separated BOQ codes: "VLV,CHK" or just "CHK" as standalone valve indicator  
      /\bvlv\s*,?\s*(chk|ball|gate|globe|check|butterfly|plug)\b/i,
      // "x ANSI ... Gate Valve" or "x ... API 600 Gate Valve"
      /\b(gate|ball|globe|check|butterfly|plug)\s+valve\b/i
    ];

    for (const pattern of patterns) {
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
    }

    return null;
  }
}

module.exports = new ValveExtractor();

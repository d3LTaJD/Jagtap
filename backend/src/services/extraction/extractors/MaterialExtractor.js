/**
 * MaterialExtractor Plugin
 * Deterministically extracts Shell / Body Material Grade using regex patterns.
 */

const { createEngineeringField, VALIDATION_STATES } = require('../../../types/EngineeringField');
const knowledgeEngine = require('../KnowledgeEngine');

class MaterialExtractor {
  constructor() {
    this.id = 'MaterialExtractor';
  }

  extract(textContext) {
    if (!textContext || typeof textContext !== 'string') return null;

    const patterns = [
      /\b(astm\s+a105|a105|a350\s+lf2|lf2|a216\s+wcb|wcb|a352\s+lcb|lcb|ss316l?|316l?ss|ss304l?|f316l?|f304l?)\b/i,
      /\b(?:body|shell|material)\s*[:=]?\s*([a-z0-9_-]+)\b/i
    ];

    for (const pattern of patterns) {
      const match = textContext.match(pattern);
      if (match && match[1]) {
        const rawValue = match[1].trim();
        const normalizedValue = knowledgeEngine.normalizeMaterial(rawValue);
        if (normalizedValue && normalizedValue.length > 1) {
          return createEngineeringField({
            fieldId: 'shellMaterial',
            fieldName: 'Body / Shell Material',
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
            reasoning: [`Regex matched material pattern: ${pattern.toString()}`]
          });
        }
      }
    }

    return null;
  }
}

module.exports = new MaterialExtractor();

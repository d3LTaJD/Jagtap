/**
 * MaterialExtractor Plugin
 * Deterministically extracts Shell / Body Material Grade using regex patterns.
 * Explicitly matches material tokens only — never defaults or infers missing materials.
 */

const { createEngineeringField, VALIDATION_STATES } = require('../../../types/EngineeringField');
const knowledgeEngine = require('../KnowledgeEngine');

class MaterialExtractor {
  constructor() {
    this.id = 'MaterialExtractor';
  }

  extract(textContext) {
    if (!textContext || typeof textContext !== 'string') return null;

    // Explicit engineering material grade patterns only
    const pattern = /\b(astm\s+a105|a105|a350\s+lf2|lf2|a216\s+wcb|wcb|a352\s+lcb|lcb|ss316l?|316l?\s*ss|ss304l?|304l?\s*ss|f316l?|f304l?|cf8m|cf8|a351\s+cf8m?|f51|f53|monel|inconel|hastelloy|cast\s+iron|ductile\s+iron)\b/i;

    const match = textContext.match(pattern);
    if (match && match[1]) {
      const rawValue = match[1].trim();
      const normalizedValue = knowledgeEngine.normalizeMaterial(rawValue);
      if (normalizedValue) {
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
          reasoning: [`Regex matched explicit material grade token: ${rawValue}`]
        });
      }
    }

    return null;
  }
}

module.exports = new MaterialExtractor();

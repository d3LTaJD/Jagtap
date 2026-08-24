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
    const pattern = /\b(astm\s+a105|a105|a-105|forged\s+steel|forged\s+carbon\s+steel|a350\s+lf2|lf2|a350-lf2|astm\s+a350\s+lf2|astm\s+a216\s+(?:gr\.?\s*)?wcb|a216\s+(?:gr\.?\s*)?wcb|a216-wcb|a-216\s*wcb|wcb|cs\s+wcb|cast\s+steel|carbon\s+steel|cs(?:\s*\([^)]+\))?|a352\s+lcb|lcb|astm\s+a352\s+lcb|astm\s+a351\s+(?:gr\.?\s*)?cf8m?|a351\s+(?:gr\.?\s*)?cf8m?|cf8m|cf8|astm\s+a182\s+(?:gr\.?\s*)?f316l?|a182\s+(?:gr\.?\s*)?f316l?|astm\s+a182\s+(?:gr\.?\s*)?f304l?|a182\s+(?:gr\.?\s*)?f304l?|ss\s*316l?|316l?\s*ss|316\s+ss|stainless\s+steel\s*316|ss\s*304l?|304l?\s*ss|304\s+ss|stainless\s+steel\s*304|f316l?|f304l?|f51|f53|monel|inconel|hastelloy|cast\s+iron|ductile\s+iron)\b/i;

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

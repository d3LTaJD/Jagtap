/**
 * StandardExtractor Plugin
 * Deterministically extracts Applicable Design/Testing Standards (API, ASME, ISO, BS).
 */

const { createEngineeringField, VALIDATION_STATES } = require('../../../types/EngineeringField');

class StandardExtractor {
  constructor() {
    this.id = 'StandardExtractor';
  }

  extract(textContext) {
    if (!textContext || typeof textContext !== 'string') return null;

    const pattern = /\b(api\s*6d|api\s*598|api\s*600|api\s*602|asme\s*b16\.34|asme\s*b16\.10|asme\s*b16\.5|iso\s*15848-1|bs\s*5351|bs\s*1868)\b/i;
    const match = textContext.match(pattern);

    if (match && match[1]) {
      const rawValue = match[1].trim();
      const normalizedValue = rawValue.toUpperCase().replace(/\s+/g, ' ');
      return createEngineeringField({
        fieldId: 'designStandard',
        fieldName: 'Applicable Standard',
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
        reasoning: [`Regex matched standard code pattern: ${pattern.toString()}`]
      });
    }

    return null;
  }
}

module.exports = new StandardExtractor();

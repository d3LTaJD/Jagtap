/**
 * TagExtractor Plugin
 * Deterministically extracts Equipment/Valve Tag Numbers (e.g. Tag: XV-101, 10-V-001).
 */

const { createEngineeringField, VALIDATION_STATES } = require('../../../types/EngineeringField');

class TagExtractor {
  constructor() {
    this.id = 'TagExtractor';
  }

  extract(textContext) {
    if (!textContext || typeof textContext !== 'string') return null;

    const pattern = /\b(?:tag|tag\s*no|item\s*tag)\s*[:=]?\s*([a-z0-9\-_]+)\b/i;
    const match = textContext.match(pattern);

    if (match && match[1]) {
      const rawValue = match[1].trim();
      return createEngineeringField({
        fieldId: 'tagNumber',
        fieldName: 'Tag Number',
        rawValue,
        normalizedValue: rawValue.toUpperCase(),
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
        reasoning: [`Regex matched tag number pattern: ${pattern.toString()}`]
      });
    }

    return null;
  }
}

module.exports = new TagExtractor();

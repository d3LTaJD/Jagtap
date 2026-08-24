/**
 * TagExtractor Plugin
 * Deterministically extracts Equipment/Valve Tag Numbers (e.g. Tag: XV-101, 10-V-001).
 * Rejects non-identifier phrases (e.g. "Tag required", "Tag attached", "Tag needed").
 */

const { createEngineeringField, VALIDATION_STATES, REVIEW_REASONS } = require('../../../types/EngineeringField');

class TagExtractor {
  constructor() {
    this.id = 'TagExtractor';
  }

  extract(textContext) {
    if (!textContext || typeof textContext !== 'string') return null;

    const pattern = /\b(?:valve\s*tag|item\s*tag|tag\s*no|tag)\s*[:=\-]?\s*([a-z0-9][a-z0-9\-_./]+)\b/i;
    const match = textContext.match(pattern);

    if (match && match[1]) {
      const rawValue = match[1].trim();
      const lower = rawValue.toLowerCase();

      // Disqualify non-identifier phrases
      const invalidWords = ['required', 'available', 'attached', 'needed', 'yes', 'no', 'na', 'n/a', 'none', 'specified', 'applicable', 'provided', 'to_be_attached'];
      if (invalidWords.includes(lower) || !/[0-9]/.test(rawValue)) {
        return null;
      }

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

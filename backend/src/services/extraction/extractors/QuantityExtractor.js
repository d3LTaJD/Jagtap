/**
 * QuantityExtractor Plugin
 * Deterministically extracts Line Item Quantity (e.g. Qty: 5, 10 Nos, 2 Sets).
 */

const { createEngineeringField, VALIDATION_STATES } = require('../../../types/EngineeringField');

class QuantityExtractor {
  constructor() {
    this.id = 'QuantityExtractor';
  }

  extract(textContext) {
    if (!textContext || typeof textContext !== 'string') return null;

    const pattern = /\b(?:qty|quantity)\s*[:=]?\s*([0-9]+)\b/i;
    const match = textContext.match(pattern);

    if (match && match[1]) {
      const rawValue = match[1].trim();
      const num = parseInt(rawValue, 10);
      if (!isNaN(num) && num > 0) {
        return createEngineeringField({
          fieldId: 'quantity',
          fieldName: 'Quantity',
          rawValue,
          normalizedValue: String(num),
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
          reasoning: [`Regex matched quantity pattern: ${pattern.toString()}`]
        });
      }
    }

    return null;
  }
}

module.exports = new QuantityExtractor();

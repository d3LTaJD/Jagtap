/**
 * DrawingExtractor Plugin
 * Deterministically extracts Drawing / P&ID Numbers (e.g. Drg: DWG-8821, PID-1002-01).
 */

const { createEngineeringField, VALIDATION_STATES } = require('../../../types/EngineeringField');

class DrawingExtractor {
  constructor() {
    this.id = 'DrawingExtractor';
  }

  extract(textContext) {
    if (!textContext || typeof textContext !== 'string') return null;

    const pattern = /\b(?:dwg|drawing|pid|p&id)\s*[:=]?\s*([a-z0-9\-_]+)\b/i;
    const match = textContext.match(pattern);

    if (match && match[1]) {
      const rawValue = match[1].trim();
      return createEngineeringField({
        fieldId: 'drawingNumber',
        fieldName: 'Drawing / P&ID Number',
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
        reasoning: [`Regex matched drawing number pattern: ${pattern.toString()}`]
      });
    }

    return null;
  }
}

module.exports = new DrawingExtractor();

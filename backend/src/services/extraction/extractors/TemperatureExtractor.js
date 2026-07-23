/**
 * TemperatureExtractor Plugin
 * Deterministically extracts Design/Operating Temperature values (e.g. -46°C, 200 deg C, 400 F).
 */

const { createEngineeringField, VALIDATION_STATES } = require('../../../types/EngineeringField');

class TemperatureExtractor {
  constructor() {
    this.id = 'TemperatureExtractor';
  }

  extract(textContext) {
    if (!textContext || typeof textContext !== 'string') return null;

    const pattern = /\b(?:temp|temperature)\s*[:=]?\s*([\-+]?[0-9\.]+\s*(?:°c|deg\s*c|°f|deg\s*f|c|f))\b/i;
    const match = textContext.match(pattern);

    if (match && match[1]) {
      const rawValue = match[1].trim();
      return createEngineeringField({
        fieldId: 'designTemperature',
        fieldName: 'Design Temperature',
        rawValue,
        normalizedValue: rawValue,
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
        reasoning: [`Regex matched temperature pattern: ${pattern.toString()}`]
      });
    }

    return null;
  }
}

module.exports = new TemperatureExtractor();

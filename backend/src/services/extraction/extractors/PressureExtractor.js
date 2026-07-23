/**
 * PressureExtractor Plugin
 * Deterministically extracts Design/Operating Pressure values (e.g. 50 bar, 100 psi, 25 kg/cm2).
 */

const { createEngineeringField, VALIDATION_STATES } = require('../../../types/EngineeringField');

class PressureExtractor {
  constructor() {
    this.id = 'PressureExtractor';
  }

  extract(textContext) {
    if (!textContext || typeof textContext !== 'string') return null;

    const pattern = /\b(?:pressure|press|dp)\s*[:=]?\s*([0-9\.]+\s*(?:bar|psi|kg\/cm2|mPa))\b/i;
    const match = textContext.match(pattern);

    if (match && match[1]) {
      const rawValue = match[1].trim();
      return createEngineeringField({
        fieldId: 'designPressure',
        fieldName: 'Design Pressure',
        rawValue,
        normalizedValue: rawValue.toLowerCase(),
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
        reasoning: [`Regex matched pressure pattern: ${pattern.toString()}`]
      });
    }

    return null;
  }
}

module.exports = new PressureExtractor();

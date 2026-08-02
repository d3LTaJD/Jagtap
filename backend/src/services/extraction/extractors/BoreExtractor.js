/**
 * BoreExtractor Plugin
 * Deterministically extracts Valve Bore Type (Full Bore / Reduced Bore) using regex patterns.
 */

const { createEngineeringField, VALIDATION_STATES } = require('../../../types/EngineeringField');

class BoreExtractor {
  constructor() {
    this.id = 'BoreExtractor';
  }

  extract(textContext) {
    if (!textContext || typeof textContext !== 'string') return null;

    const pattern = /\b(full\s*bore|full\s*port|fb|reduced\s*bore|regular\s*port|rb)\b/i;
    const match = textContext.match(pattern);

    if (match && match[1]) {
      const rawValue = match[1].trim();
      const lower = rawValue.toLowerCase();
      const normalizedValue = (lower.includes('full') || lower === 'fb') ? 'Full Bore' : 'Reduced Bore';

      return createEngineeringField({
        fieldId: 'valve_bore',
        fieldName: 'Bore Type',
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
        reasoning: [`Regex matched bore pattern: ${pattern.toString()}`]
      });
    }

    return null;
  }
}

module.exports = new BoreExtractor();

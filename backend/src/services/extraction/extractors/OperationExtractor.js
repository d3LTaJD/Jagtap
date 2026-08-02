/**
 * OperationExtractor Plugin
 * Deterministically extracts Valve Operation / Actuation Type using regex patterns.
 */

const { createEngineeringField, VALIDATION_STATES } = require('../../../types/EngineeringField');

class OperationExtractor {
  constructor() {
    this.id = 'OperationExtractor';
  }

  extract(textContext) {
    if (!textContext || typeof textContext !== 'string') return null;

    const pattern = /\b(motorized|pneumatic|gear\s+operated|gear|lever\s+operated|lever|handwheel|manual|bare\s+shaft|actuated)\b/i;
    const match = textContext.match(pattern);

    if (match && match[1]) {
      const rawValue = match[1].trim();
      const lower = rawValue.toLowerCase();
      let normalizedValue = 'Manual';

      if (lower.includes('motorized')) normalizedValue = 'Motorized';
      else if (lower.includes('pneumatic') || lower.includes('actuated')) normalizedValue = 'Pneumatic';
      else if (lower.includes('gear')) normalizedValue = 'Gear Operated';
      else if (lower.includes('lever')) normalizedValue = 'Lever Operated';
      else if (lower.includes('bare')) normalizedValue = 'Bare Shaft';
      else if (lower.includes('manual') || lower.includes('handwheel')) normalizedValue = 'Manual';

      return createEngineeringField({
        fieldId: 'valve_operating',
        fieldName: 'Operating Type',
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
        reasoning: [`Regex matched explicit operation token: ${rawValue}`]
      });
    }

    return null;
  }
}

module.exports = new OperationExtractor();

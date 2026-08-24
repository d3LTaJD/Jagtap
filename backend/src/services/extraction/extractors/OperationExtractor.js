/**
 * OperationExtractor Plugin
 * Deterministically extracts Valve Operation / Actuation Type with negation filtering
 * and manual override disambiguation.
 */

const { createEngineeringField, VALIDATION_STATES, REVIEW_REASONS } = require('../../../types/EngineeringField');
const negationDetector = require('../NegationDetector');

class OperationExtractor {
  constructor() {
    this.id = 'OperationExtractor';
  }

  extract(textContext) {
    if (!textContext || typeof textContext !== 'string') return null;

    const pattern = /\b(motorized|motoriz|pneumatic\s+actuator|pneumatic|electric\s+actuator|electric|hydraulic\s+actuator|hydraulic|gear\s+operated|gearbox|gear|lever\s+operated|lever|handwheel|manual\s+override|manual|bare\s+shaft|actuated)\b/i;
    const match = textContext.match(pattern);

    if (match && match[1]) {
      const matchIndex = match.index;
      const rawValue = match[1].trim();
      const lower = rawValue.toLowerCase();

      // Check for negation (e.g. "Pneumatic actuator not required", "without gear operator")
      const negCheck = negationDetector.isNegated(textContext, matchIndex, match[0].length);
      if (negCheck.isNegated) {
        return createEngineeringField({
          fieldId: 'valve_operating',
          fieldName: 'Operating Type',
          rawValue,
          normalizedValue: null,
          extractor: this.id,
          score: {
            confidence: 0,
            authority: 90,
            agreement: 100,
            validation: 0,
            completeness: 0,
            risk: 'HIGH'
          },
          validationState: VALIDATION_STATES.INVALID,
          reviewReason: REVIEW_REASONS.RULE_VIOLATION,
          reasoning: [`Operation type negated: ${negCheck.reason}`]
        });
      }

      // If text mentions "manual override", it describes an accessory, not the primary valve actuation
      if (lower.includes('manual override')) {
        // If main text also has pneumatic/motorized/electric, prioritize the primary actuation
        if (/\b(?:pneumatic|motorized|electric|hydraulic)\b/i.test(textContext)) {
          const primaryMatch = textContext.match(/\b(pneumatic|motorized|electric|hydraulic)\b/i);
          if (primaryMatch) {
            const primVal = primaryMatch[1].toLowerCase();
            const normVal = primVal.includes('pneumatic') ? 'Pneumatic' : (primVal.includes('motorized') ? 'Motorized' : 'Electric');
            return createEngineeringField({
              fieldId: 'valve_operating',
              fieldName: 'Operating Type',
              rawValue: `${primaryMatch[1]} with manual override`,
              normalizedValue: normVal,
              extractor: this.id,
              score: { confidence: 100, authority: 95, agreement: 100, validation: 100, completeness: 100, risk: 'LOW' },
              validationState: VALIDATION_STATES.VALID,
              reasoning: [`Detected primary actuation "${normVal}" with manual override accessory`]
            });
          }
        }
        // Otherwise it is ambiguous
        return createEngineeringField({
          fieldId: 'valve_operating',
          fieldName: 'Operating Type',
          rawValue,
          normalizedValue: null,
          extractor: this.id,
          score: { confidence: 50, authority: 80, agreement: 50, validation: 50, completeness: 0, risk: 'MEDIUM' },
          validationState: VALIDATION_STATES.AMBIGUOUS,
          reviewReason: REVIEW_REASONS.MULTIPLE_MATCHES,
          reasoning: ['"manual override" specifies an accessory; primary actuation requires review']
        });
      }

      let normalizedValue = 'Manual';
      if (lower.includes('motoriz')) normalizedValue = 'Motorized';
      else if (lower.includes('pneumatic') || lower.includes('actuated')) normalizedValue = 'Pneumatic';
      else if (lower.includes('electric')) normalizedValue = 'Electric';
      else if (lower.includes('hydraulic')) normalizedValue = 'Hydraulic';
      else if (lower.includes('gear')) normalizedValue = 'Gear Operated';
      else if (lower.includes('lever')) normalizedValue = 'Lever Operated';
      else if (lower.includes('bare')) normalizedValue = 'Bare Shaft';
      else if (lower.includes('manual') || lower.includes('handwheel')) normalizedValue = 'Manual';

      // Check for ambiguity (e.g. "Lever or Gear Operated")
      const ambCheck = negationDetector.isAmbiguous(textContext, ['pneumatic', 'manual', 'gear', 'lever', 'motorized', 'electric', 'bare shaft'], matchIndex, match[0].length);
      if (ambCheck.isAmbiguous) {
        return createEngineeringField({
          fieldId: 'valve_operating',
          fieldName: 'Operating Type',
          rawValue,
          normalizedValue: null,
          extractor: this.id,
          score: { confidence: 50, authority: 80, agreement: 50, validation: 50, completeness: 0, risk: 'MEDIUM' },
          validationState: VALIDATION_STATES.AMBIGUOUS,
          reviewReason: REVIEW_REASONS.MULTIPLE_MATCHES,
          reasoning: [`Operation type ambiguous: ${ambCheck.reason}`]
        });
      }

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

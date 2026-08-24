/**
 * ValveExtractor Plugin
 * Deterministically extracts Valve Type with false positive rejection (e.g. "check the following"),
 * negation filtering ("gate valve not required"), and ambiguity handling.
 */

const { createEngineeringField, VALIDATION_STATES, REVIEW_REASONS } = require('../../../types/EngineeringField');
const knowledgeEngine = require('../KnowledgeEngine');
const negationDetector = require('../NegationDetector');

class ValveExtractor {
  constructor() {
    this.id = 'ValveExtractor';
  }

  extract(textContext) {
    if (!textContext || typeof textContext !== 'string') return null;

    // Reject false action verbs: "check the following", "check attached", "check below", "check datasheet"
    // when they do not specify a check valve.
    const isActionVerbCheck = /\bcheck\s+(?:the|attached|below|following|datasheet|enclosed|spec|specification|document|drawing|p&id|details|tender)\b/i;

    const patterns = [
      // Explicit full compound valve types
      /\b(floating\s+ball\s+valves?|trunnion\s+mounted\s+ball\s+valves?|trunnion\s+ball\s+valves?|knife\s+gate\s+valves?|wedge\s+gate\s+valves?|swing\s+check\s+valves?|lift\s+check\s+valves?|dual\s+plate\s+check\s+valves?|non\s+return\s+valves?|pressure\s+relief\s+valves?|safety\s+valves?)\b/i,
      // Standard valve types
      /\b(ball\s+valves?|globe\s+valves?|gate\s+valves?|check\s+valves?|butterfly\s+valves?|plug\s+valves?|control\s+valves?|needle\s+valves?|nrv|bfv|srv|prv)\b/i,
      // Shorthand followed by standard or size/class: "Ball API 6D", "Gate 150#", "Check DN100"
      /\b(ball|gate|globe|check|butterfly|plug|control|needle)\b(?=\s+(?:valves?|api|trunnion|class|cl|\d+in|\d+"|150#|300#|600#|800#|900#|1500#|2500#))/i,
      // BOQ shorthand: "BALL API6D", "GATE API600", "CHECK API6D"
      /\b(ball|gate|globe|check|butterfly|plug)\b\s+(?:api\s*\d+|ansi|asme)/i,
      // Comma-separated BOQ codes: "VLV,CHK" or "VLV,BALL"
      /\bvlv\s*,?\s*(chk|ball|gate|globe|check|butterfly|plug)\b/i
    ];

    for (const pattern of patterns) {
      const match = textContext.match(pattern);
      if (match && match[1]) {
        const matchIndex = match.index;
        const rawValue = match[1].trim();

        // 1. If matched "check" but it's an action verb phrase, skip unless it explicitly says "check valve"
        if (rawValue.toLowerCase() === 'check' && isActionVerbCheck.test(textContext.substring(matchIndex, matchIndex + 30))) {
          continue;
        }

        // 2. Check for negation (e.g. "Gate valve is not required", "without butterfly valve")
        const negCheck = negationDetector.isNegated(textContext, matchIndex, match[0].length);
        if (negCheck.isNegated) {
          return createEngineeringField({
            fieldId: 'valve_type',
            fieldName: 'Valve Type',
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
            reasoning: [`Valve type negated: ${negCheck.reason}`]
          });
        }

        // 3. Normalize valve type
        const normalizedValue = knowledgeEngine.normalizeValveType(rawValue);
        if (normalizedValue) {
          // Check for ambiguity (e.g. "Ball valve / Gate valve alternative", "Ball valve or Gate valve")
          const ambCheck = negationDetector.isAmbiguous(textContext, ['ball valve', 'gate valve', 'globe valve', 'check valve', 'butterfly valve', 'plug valve'], matchIndex, match[0].length);
          if (ambCheck.isAmbiguous) {
            return createEngineeringField({
              fieldId: 'valve_type',
              fieldName: 'Valve Type',
              rawValue,
              normalizedValue: null,
              extractor: this.id,
              score: {
                confidence: 50,
                authority: 80,
                agreement: 50,
                validation: 50,
                completeness: 0,
                risk: 'MEDIUM'
              },
              validationState: VALIDATION_STATES.AMBIGUOUS,
              reviewReason: REVIEW_REASONS.MULTIPLE_MATCHES,
              reasoning: [`Valve type ambiguous: ${ambCheck.reason}`]
            });
          }

          return createEngineeringField({
            fieldId: 'valve_type',
            fieldName: 'Valve Type',
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
            reasoning: [`Regex matched valve type pattern: ${pattern.toString()}`]
          });
        }
      }
    }

    return null;
  }
}

module.exports = new ValveExtractor();

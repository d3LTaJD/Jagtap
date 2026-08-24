/**
 * QuantityExtractor Plugin
 * Deterministically extracts Line Item Quantity (e.g. Qty: 5, 10 Nos, 2 Sets, 20 EA, 12 pcs).
 * Strictly avoids mistaking pressure ratings (Class 300), sizes (4"), or standards (API 600) for quantity.
 */

const { createEngineeringField, VALIDATION_STATES, REVIEW_REASONS } = require('../../../types/EngineeringField');

class QuantityExtractor {
  constructor() {
    this.id = 'QuantityExtractor';
  }

  extract(textContext) {
    if (!textContext || typeof textContext !== 'string') return null;

    // Pattern 1: Explicit Qty prefix (e.g. "Qty: 5", "Quantity = 10", "QTY 5", "Qty-20")
    // Word boundary guards on units prevent "5 Flanged" or "5 Female" from triggering lookahead rejection
    const explicitPrefixPattern = /\b(?:qty|quantity|quantities)\s*[:=\-]?\s*([0-9]+)\b(?!\s*(?:#|psi\b|bar\b|class\b|inch\b|in\b|mm\b|nb\b|dn\b|°[cf]|deg\b|kg\b|lbs\b))/i;
    let match = textContext.match(explicitPrefixPattern);

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
          reasoning: [`Regex matched explicit quantity prefix pattern: ${explicitPrefixPattern.toString()}`]
        });
      }
    }

    // Pattern 2: Suffix units (e.g. "5 Nos", "10 Nos.", "2 Sets", "20 EA", "12 pcs", "5 pieces", "3 Numbers")
    const unitSuffixPattern = /\b([0-9]+)\s*(?:nos\.?|numbers?|sets?|ea\.?|pcs\.?|pieces?)\b/i;
    match = textContext.match(unitSuffixPattern);

    if (match && match[1]) {
      const matchIndex = match.index;
      // Ensure the number is not preceded by Class, Size, DN, NPS, API, DWG, Drawing, Tag
      const prefixContext = textContext.substring(Math.max(0, matchIndex - 20), matchIndex).toLowerCase();
      if (!/\b(?:class|cl|size|dn|nps|api|dwg|drawing|tag|item|ref)\s*[:=\-]?\s*$/i.test(prefixContext)) {
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
            reasoning: [`Regex matched quantity with unit suffix: ${unitSuffixPattern.toString()}`]
          });
        }
      }
    }

    return null;
  }
}

module.exports = new QuantityExtractor();

/**
 * DrawingExtractor Plugin
 * Deterministically extracts Drawing / P&ID Numbers (e.g. Drg: DWG-8821, PID-1002-01).
 * Rejects non-identifier phrases (e.g. "Drawing required", "DWG available", "Drawing attached").
 */

const { createEngineeringField, VALIDATION_STATES, REVIEW_REASONS } = require('../../../types/EngineeringField');

class DrawingExtractor {
  constructor() {
    this.id = 'DrawingExtractor';
  }

  extract(textContext) {
    if (!textContext || typeof textContext !== 'string') return null;

    const patterns = [
      // Pattern 1: Direct hyphenated/underscored identifiers: "DWG-1234-A", "PID-1002-01", "P&ID-1002"
      /\b((?:dwg|pid|p&id)[-_][a-z0-9\-_./]+)\b/i,
      // Pattern 2: Key-value formatted: "Drawing No: ABC-001", "P&ID: P-1002", "DWG: 8821"
      /\b(?:dwg|drawing|drawing\s*no|pid|p&id)\s*[:=]\s*([a-z0-9][a-z0-9\-_./]+)\b/i
    ];

    for (const pattern of patterns) {
      const match = textContext.match(pattern);
      if (match && match[1]) {
        const rawValue = match[1].trim();
        const lower = rawValue.toLowerCase();

        // Disqualify non-identifier words (e.g. "required", "available", "attached", "needed", "yes", "no", "na")
        const invalidWords = ['required', 'available', 'attached', 'needed', 'yes', 'no', 'na', 'n/a', 'none', 'specified', 'applicable', 'provided', 'to_be_provided'];
        if (invalidWords.includes(lower) || !/[0-9]/.test(rawValue)) {
          continue;
        }

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
    }

    return null;
  }
}

module.exports = new DrawingExtractor();

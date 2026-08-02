/**
 * FieldConfidenceEngine.js
 * Calculates per-field confidence scores based on extraction source, validation state, and dictionary match.
 * Gates products: if any required field has confidence < 85%, status becomes 'needs_review'.
 */

const CONFIDENCE_WEIGHTS = Object.freeze({
  REGEX_EXACT: 100,
  BOQ_PARSER: 100,
  TENDER_SOR: 100,
  REGEX_NORMALIZED: 95,
  AI_VALIDATED: 80,
  AI_NORMALIZED: 75,
  FUZZY_MATCH: 60,
  AI_AMBIGUOUS: 50,
  INVALID: 0,
  NOT_FOUND: 0
});

class FieldConfidenceEngine {
  /**
   * Calculates confidence score for a field given source, method, and validation state.
   * @param {Object} params
   * @returns {Object} { confidence: number, reasoning: string, isAcceptable: boolean }
   */
  calculateFieldConfidence({ fieldName, rawValue, normalizedValue, extractionMethod, validationState, isRequired = false }) {
    if (validationState === 'INVALID' || !normalizedValue) {
      return {
        confidence: 0,
        reasoning: `Field "${fieldName}" failed validation or has no value`,
        isAcceptable: false
      };
    }

    let confidence = 0;
    let reasoning = '';

    switch (extractionMethod) {
      case 'REGEX':
        confidence = rawValue === normalizedValue ? CONFIDENCE_WEIGHTS.REGEX_EXACT : CONFIDENCE_WEIGHTS.REGEX_NORMALIZED;
        reasoning = `Deterministic regex match (${confidence}% confidence)`;
        break;

      case 'BOQ_PARSER':
        confidence = CONFIDENCE_WEIGHTS.BOQ_PARSER;
        reasoning = `Structured BOQ table parser (100% confidence)`;
        break;

      case 'TENDER_SOR':
        confidence = CONFIDENCE_WEIGHTS.TENDER_SOR;
        reasoning = `Tender Schedule of Rates table match (100% confidence)`;
        break;

      case 'AI':
        if (validationState === 'VALID') {
          confidence = CONFIDENCE_WEIGHTS.AI_NORMALIZED;
          reasoning = `AI extraction validated by Engineering Dictionary (${confidence}% confidence)`;
        } else if (validationState === 'AMBIGUOUS') {
          confidence = CONFIDENCE_WEIGHTS.AI_AMBIGUOUS;
          reasoning = `AI extraction ambiguous validation (${confidence}% confidence)`;
        } else {
          confidence = 0;
          reasoning = `AI extraction rejected by Validation Engine`;
        }
        break;

      case 'USER_MANUAL':
        confidence = 100;
        reasoning = `Manually verified by engineer (100% confidence)`;
        break;

      default:
        confidence = 50;
        reasoning = `Default heuristic confidence (${confidence}%)`;
    }

    const isAcceptable = confidence >= 85;

    return {
      confidence,
      reasoning,
      isAcceptable
    };
  }

  /**
   * Evaluates overall product extraction status across all field confidences.
   * @param {Object} fieldConfidences Map of fieldName -> { confidence, validationState, isRequired }
   * @param {number} minThreshold Default 85
   * @returns {Object} { status: 'validated'|'needs_review', overallConfidence: number, fieldsNeedingReview: Array }
   */
  evaluateProductStatus(fieldConfidences, minThreshold = 85) {
    if (!fieldConfidences || Object.keys(fieldConfidences).length === 0) {
      return { status: 'needs_review', overallConfidence: 0, fieldsNeedingReview: [] };
    }

    const entries = Object.entries(fieldConfidences);
    const validEntries = entries.filter(([_, data]) => data && data.confidence > 0);

    if (validEntries.length === 0) {
      return { status: 'needs_review', overallConfidence: 0, fieldsNeedingReview: Object.keys(fieldConfidences) };
    }

    const totalConf = validEntries.reduce((sum, [_, data]) => sum + data.confidence, 0);
    const overallConfidence = Math.round(totalConf / validEntries.length);

    const fieldsNeedingReview = [];
    for (const [field, data] of entries) {
      if (data && (data.confidence < minThreshold || data.validationState === 'INVALID')) {
        fieldsNeedingReview.push(field);
      }
    }

    const status = fieldsNeedingReview.length === 0 ? 'validated' : 'needs_review';

    return {
      status,
      overallConfidence,
      fieldsNeedingReview
    };
  }
}

module.exports = new FieldConfidenceEngine();

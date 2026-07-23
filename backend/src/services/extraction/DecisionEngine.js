/**
 * DecisionEngine
 * Final engineering decision maker.
 * Resolves evidence conflicts, evaluates multi-dimensional score matrix,
 * and assigns explicit review reasons for human review routing.
 */

const { createEngineeringField, VALIDATION_STATES, REVIEW_REASONS } = require('../../types/EngineeringField');
const scoringEngine = require('./ScoringEngine');
const validationEngine = require('./ValidationEngine');

class DecisionEngine {
  /**
   * Resolves final field value from multi-doc evidence evaluation.
   * @param {string} fieldId 
   * @param {string} fieldName 
   * @param {Object} evidenceEvaluation Output from EvidenceEngine.evaluateFieldEvidence()
   */
  makeDecision(fieldId, fieldName, evidenceEvaluation) {
    if (!evidenceEvaluation || !evidenceEvaluation.hasEvidence) {
      return createEngineeringField({
        fieldId,
        fieldName,
        rawValue: null,
        normalizedValue: null,
        validationState: VALIDATION_STATES.NOT_FOUND,
        reviewReason: REVIEW_REASONS.MISSING_REQUIRED_FIELD,
        reasoning: ['No extraction evidence found in input documents']
      });
    }

    const { consensusValue, agreementScore, highestAuthority, winningGroup, totalEvidenceCount, evidence } = evidenceEvaluation;

    // Run validation on consensus value
    const validationResult = validationEngine.validateField(fieldId, consensusValue);

    // Conflict & Review Reason Evaluation
    let reviewReason = null;
    let finalState = validationResult.state;

    if (validationResult.state === VALIDATION_STATES.INVALID) {
      reviewReason = REVIEW_REASONS.INVALID_VALUE;
    } else if (agreementScore < 80 && totalEvidenceCount > 1) {
      finalState = VALIDATION_STATES.AMBIGUOUS;
      reviewReason = REVIEW_REASONS.DOCUMENT_CONFLICT;
    } else if (highestAuthority < 50) {
      finalState = VALIDATION_STATES.AMBIGUOUS;
      reviewReason = REVIEW_REASONS.LOW_CONFIDENCE;
    }

    // Calculate 6-dimensional score matrix
    const score = scoringEngine.calculateScore({
      confidence: highestAuthority,
      authority: highestAuthority,
      agreement: agreementScore,
      validationState: finalState,
      hasNormalizedValue: !!consensusValue
    });

    const winningRaw = winningGroup?.items[0]?.rawValue || consensusValue;

    return createEngineeringField({
      fieldId,
      fieldName,
      rawValue: winningRaw,
      normalizedValue: consensusValue,
      sourceDocument: winningGroup?.items[0]?.sourceDocument || '',
      page: winningGroup?.items[0]?.page || 1,
      extractor: winningGroup?.items[0]?.extractor || 'DecisionEngine',
      score,
      validationState: finalState,
      reviewReason,
      evidence,
      reasoning: [
        `Decision Engine selected "${consensusValue}" based on ${winningGroup?.count}/${totalEvidenceCount} matching evidence items (${agreementScore}% agreement).`,
        validationResult.reason
      ]
    });
  }
}

module.exports = new DecisionEngine();

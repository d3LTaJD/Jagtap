/**
 * ScoringEngine
 * Calculates multi-dimensional extraction score matrix for an EngineeringField.
 * Evaluates: Confidence, Authority, Agreement, Validation, Completeness, and Risk.
 */

class ScoringEngine {
  /**
   * Calculates multi-dimensional score matrix.
   * @param {Object} params Evaluation parameters.
   */
  calculateScore({
    confidence = 0,
    authority = 85,
    agreement = 100,
    validationState = 'VALID',
    hasNormalizedValue = true
  }) {
    const isValValid = validationState === 'VALID';
    const validationScore = isValValid ? 100 : validationState === 'AMBIGUOUS' ? 50 : 0;
    const completenessScore = hasNormalizedValue ? 100 : 0;

    // Overall Risk Matrix Calculation
    let risk = 'LOW';
    if (!isValValid || agreement < 50 || confidence < 50) {
      risk = 'HIGH';
    } else if (agreement < 80 || confidence < 80 || authority < 70) {
      risk = 'MEDIUM';
    }

    return Object.freeze({
      confidence: Math.min(100, Math.max(0, confidence)),
      authority: Math.min(100, Math.max(0, authority)),
      agreement: Math.min(100, Math.max(0, agreement)),
      validation: validationScore,
      completeness: completenessScore,
      risk
    });
  }
}

module.exports = new ScoringEngine();

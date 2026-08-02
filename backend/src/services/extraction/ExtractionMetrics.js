/**
 * ExtractionMetrics.js
 * Production-grade telemetry and metrics tracker for the extraction pipeline.
 * Tracks field accuracy, AI fallback rate, human review rate, rejection rate, and learning rate.
 */

class ExtractionMetrics {
  constructor() {
    this.reset();
  }

  reset() {
    this.totalRuns = 0;
    this.totalProducts = 0;
    this.totalFieldsExtracted = 0;
    this.validFieldsCount = 0;
    this.ambiguousFieldsCount = 0;
    this.invalidFieldsCount = 0;
    this.hallucinationBlockedCount = 0;

    // Phase 2 metrics
    this.regexExtractedCount = 0;       // Fields extracted by regex
    this.aiExtractedCount = 0;          // Fields where AI was called
    this.aiAcceptedCount = 0;           // AI values that passed validation
    this.aiRejectedCount = 0;           // AI values rejected by validation
    this.productsValidated = 0;         // Products that passed all validation
    this.productsNeedingReview = 0;     // Products flagged for human review
    this.correctionsReceived = 0;       // User corrections recorded
    this.correctionsPromoted = 0;       // Corrections promoted to dictionary
    this.consistencyConflicts = 0;      // Document-level consistency conflicts
    this.crossFieldViolations = 0;      // Cross-field impossibility rule hits
  }

  recordPipelineRun(resultFields) {
    this.totalRuns += 1;
    if (!resultFields) return;

    const fields = Object.entries(resultFields).filter(([k]) => !k.startsWith('_'));
    fields.forEach(([, field]) => {
      if (!field) return;
      this.totalFieldsExtracted += 1;
      if (field.validationState === 'VALID') {
        this.validFieldsCount += 1;
      } else if (field.validationState === 'AMBIGUOUS') {
        this.ambiguousFieldsCount += 1;
      } else if (field.validationState === 'INVALID') {
        this.invalidFieldsCount += 1;
        this.hallucinationBlockedCount += 1;
      }
    });
  }

  recordGatedPipelineResult({ regexFieldCount, aiFieldCount, aiAccepted, aiRejected, extractionStatus }) {
    this.totalProducts += 1;
    this.regexExtractedCount += regexFieldCount || 0;
    this.aiExtractedCount += aiFieldCount || 0;
    this.aiAcceptedCount += aiAccepted || 0;
    this.aiRejectedCount += aiRejected || 0;

    if (extractionStatus === 'validated' || extractionStatus === 'approved') {
      this.productsValidated += 1;
    } else if (extractionStatus === 'needs_review') {
      this.productsNeedingReview += 1;
    }
  }

  recordCorrection({ promoted = false } = {}) {
    this.correctionsReceived += 1;
    if (promoted) this.correctionsPromoted += 1;
  }

  recordConsistencyConflict() {
    this.consistencyConflicts += 1;
  }

  recordCrossFieldViolation(count = 1) {
    this.crossFieldViolations += count;
  }

  getSummary() {
    const accuracy = this.totalFieldsExtracted > 0
      ? Math.round((this.validFieldsCount / this.totalFieldsExtracted) * 100)
      : 100;

    const totalAI = this.aiExtractedCount || 1;
    const aiFallbackRate = this.totalFieldsExtracted > 0
      ? Math.round((this.aiExtractedCount / (this.regexExtractedCount + this.aiExtractedCount || 1)) * 100)
      : 0;

    const humanReviewRate = this.totalProducts > 0
      ? Math.round((this.productsNeedingReview / this.totalProducts) * 100)
      : 0;

    const aiAcceptanceRate = totalAI > 0
      ? Math.round((this.aiAcceptedCount / totalAI) * 100)
      : 0;

    const rejectionRate = this.totalFieldsExtracted > 0
      ? Math.round((this.hallucinationBlockedCount / this.totalFieldsExtracted) * 100)
      : 0;

    return {
      // Overall
      totalRuns: this.totalRuns,
      totalProducts: this.totalProducts,
      totalFieldsExtracted: this.totalFieldsExtracted,
      fieldAccuracyPercentage: accuracy,

      // Extraction source breakdown
      regexExtractedCount: this.regexExtractedCount,
      aiExtractedCount: this.aiExtractedCount,
      aiFallbackRatePercentage: aiFallbackRate,

      // AI quality
      aiAcceptedCount: this.aiAcceptedCount,
      aiRejectedCount: this.aiRejectedCount,
      aiAcceptanceRatePercentage: aiAcceptanceRate,

      // Validation
      validFieldsCount: this.validFieldsCount,
      ambiguousFieldsCount: this.ambiguousFieldsCount,
      invalidFieldsCount: this.invalidFieldsCount,
      hallucinationBlockedCount: this.hallucinationBlockedCount,
      rejectionRatePercentage: rejectionRate,

      // Product-level
      productsValidated: this.productsValidated,
      productsNeedingReview: this.productsNeedingReview,
      humanReviewRatePercentage: humanReviewRate,

      // Learning
      correctionsReceived: this.correctionsReceived,
      correctionsPromoted: this.correctionsPromoted,

      // Quality
      consistencyConflicts: this.consistencyConflicts,
      crossFieldViolations: this.crossFieldViolations
    };
  }
}

module.exports = new ExtractionMetrics();

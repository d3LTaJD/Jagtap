/**
 * ExtractionMetrics
 * Telemetry and metric tracker for document intelligence extraction.
 * Measures accuracy, hallucination prevention rate, field error breakdown, and review frequency.
 */

class ExtractionMetrics {
  constructor() {
    this.totalRuns = 0;
    this.totalFieldsExtracted = 0;
    this.validFieldsCount = 0;
    this.ambiguousFieldsCount = 0;
    this.invalidFieldsCount = 0;
    this.hallucinationBlockedCount = 0;
  }

  recordPipelineRun(resultFields) {
    this.totalRuns += 1;
    if (!resultFields) return;

    const fields = Object.values(resultFields);
    fields.forEach(field => {
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

  getSummary() {
    const accuracy = this.totalFieldsExtracted > 0
      ? Math.round((this.validFieldsCount / this.totalFieldsExtracted) * 100)
      : 100;

    return {
      totalRuns: this.totalRuns,
      totalFieldsExtracted: this.totalFieldsExtracted,
      validFieldsCount: this.validFieldsCount,
      ambiguousFieldsCount: this.ambiguousFieldsCount,
      invalidFieldsCount: this.invalidFieldsCount,
      hallucinationBlockedCount: this.hallucinationBlockedCount,
      accuracyPercentage: accuracy
    };
  }
}

module.exports = new ExtractionMetrics();

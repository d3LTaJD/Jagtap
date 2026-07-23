/**
 * Canonical EngineeringField Data Model & Factory
 * Every extractor, matcher, validator, and service in the extraction pipeline
 * exchanges this strongly-typed object.
 */

const DOCUMENT_AUTHORITY_WEIGHTS = {
  VENDOR_DATASHEET: 100,
  BOQ: 95,
  TECHNICAL_SPEC: 95,
  ENGINEERING_DRAWING: 90,
  PURCHASE_RFQ: 85,
  EMAIL_BODY: 60,
  AI_OCR_LOCATOR: 40
};

const VALIDATION_STATES = Object.freeze({
  VALID: 'VALID',
  AMBIGUOUS: 'AMBIGUOUS',
  INVALID: 'INVALID',
  NOT_FOUND: 'NOT_FOUND'
});

const REVIEW_REASONS = Object.freeze({
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  MULTIPLE_MATCHES: 'MULTIPLE_MATCHES',
  DOCUMENT_CONFLICT: 'DOCUMENT_CONFLICT',
  INVALID_VALUE: 'INVALID_VALUE',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  RULE_VIOLATION: 'RULE_VIOLATION',
  USER_REQUESTED: 'USER_REQUESTED'
});

/**
 * Creates an immutable EngineeringField object.
 */
function createEngineeringField({
  fieldId,
  fieldName,
  rawValue = null,
  normalizedValue = null,
  masterDataId = null,
  sourceDocument = '',
  page = 1,
  table = null,
  row = null,
  column = null,
  extractor = 'Deterministic',
  score = {},
  validationState = VALIDATION_STATES.NOT_FOUND,
  reviewReason = null,
  evidence = [],
  reasoning = [],
  timestamp = new Date()
}) {
  const defaultScore = {
    confidence: score.confidence ?? 0,
    authority: score.authority ?? DOCUMENT_AUTHORITY_WEIGHTS.EMAIL_BODY,
    agreement: score.agreement ?? 100,
    validation: score.validation ?? 100,
    completeness: score.completeness ?? (normalizedValue ? 100 : 0),
    risk: score.risk ?? (validationState === VALIDATION_STATES.VALID ? 'LOW' : 'HIGH')
  };

  return Object.freeze({
    fieldId,
    fieldName,
    rawValue,
    normalizedValue,
    masterDataId,
    sourceDocument,
    page,
    table,
    row,
    column,
    extractor,
    score: Object.freeze(defaultScore),
    validationState,
    reviewReason,
    evidence: Object.freeze([...evidence]),
    reasoning: Object.freeze([...reasoning]),
    timestamp
  });
}

module.exports = {
  createEngineeringField,
  DOCUMENT_AUTHORITY_WEIGHTS,
  VALIDATION_STATES,
  REVIEW_REASONS
};

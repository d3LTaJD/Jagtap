/**
 * Phase 3 Unit Test Verification Script
 * Tests ScoringEngine, ValidationEngine, DependencyRuleEngine, and DecisionEngine.
 */

const { VALIDATION_STATES, REVIEW_REASONS } = require('../types/EngineeringField');
const scoringEngine = require('../services/extraction/ScoringEngine');
const validationEngine = require('../services/extraction/ValidationEngine');
const dependencyRuleEngine = require('../services/extraction/DependencyRuleEngine');
const decisionEngine = require('../services/extraction/DecisionEngine');

function assertEqual(actual, expected, testName) {
  if (actual === expected) {
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}: Expected "${expected}", got "${actual}"`);
    process.exitCode = 1;
  }
}

console.log('=== RUNNING PHASE 3 PIPELINE TESTS ===\n');

// 1. Test ScoringEngine
const score = scoringEngine.calculateScore({
  confidence: 100,
  authority: 95,
  agreement: 100,
  validationState: VALIDATION_STATES.VALID
});
assertEqual(score.risk, 'LOW', 'ScoringEngine low risk calculation');
assertEqual(score.confidence, 100, 'ScoringEngine confidence 100');

// 2. Test ValidationEngine
const validSize = validationEngine.validateField('valve_size', '50');
assertEqual(validSize.state, VALIDATION_STATES.VALID, 'ValidationEngine valid size 50');

const invalidSize = validationEngine.validateField('valve_size', '9000');
assertEqual(invalidSize.state, VALIDATION_STATES.INVALID, 'ValidationEngine rejects impossible size 9000');

// 3. Test DependencyRuleEngine
const fieldsDict = {
  valve_type: { normalizedValue: 'Check Valve' },
  valve_operating: { rawValue: 'Handwheel', normalizedValue: 'Handwheel' }
};
const ruleOutput = dependencyRuleEngine.applyRules(fieldsDict);
assertEqual(ruleOutput.valve_operating.normalizedValue, null, 'DependencyRuleEngine nullifies operator for Check Valve');

// 4. Test DecisionEngine with document conflict
const evidenceEvalConflict = {
  hasEvidence: true,
  consensusValue: '300#',
  agreementScore: 50, // 50% conflict
  highestAuthority: 100,
  totalEvidenceCount: 2,
  winningGroup: { count: 1, items: [{ rawValue: '300#' }] },
  evidence: []
};

const conflictDecision = decisionEngine.makeDecision('valve_class', 'Pressure Class', evidenceEvalConflict);
assertEqual(conflictDecision.validationState, VALIDATION_STATES.AMBIGUOUS, 'DecisionEngine flags AMBIGUOUS on document conflict');
assertEqual(conflictDecision.reviewReason, REVIEW_REASONS.DOCUMENT_CONFLICT, 'DecisionEngine flags DOCUMENT_CONFLICT review reason');

console.log('\n=== ALL PHASE 3 PIPELINE TESTS COMPLETED ===');

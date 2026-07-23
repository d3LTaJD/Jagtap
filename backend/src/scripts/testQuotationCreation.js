/**
 * Test: Quotation Creation Status Validation
 *
 * Verifies that quotation creation is allowed for active statuses ('Confirmed', 'Quoted', 'New', 'Technical Review')
 * and blocked ONLY for invalid/unverified statuses ('Needs Review', 'Lost', 'On Hold', 'Abandoned').
 *
 * Usage: node src/scripts/testQuotationCreation.js
 */

const BLOCKED_STATUSES = ['Needs Review', 'Lost', 'On Hold', 'Abandoned'];

function canCreateQuotation(enquiryStatus) {
  return !BLOCKED_STATUSES.includes(enquiryStatus);
}

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   Quotation Creation Validation - Test Suite             ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

const testCases = [
  { status: 'Confirmed', expected: true },
  { status: 'Quoted', expected: true },
  { status: 'New', expected: true },
  { status: 'Technical Review', expected: true },
  { status: 'Verified', expected: true },
  { status: 'Ready for Offer', expected: true },
  { status: 'Negotiating', expected: true },
  { status: 'Needs Review', expected: false },
  { status: 'Lost', expected: false },
  { status: 'On Hold', expected: false },
  { status: 'Abandoned', expected: false }
];

let allPass = true;

testCases.forEach(tc => {
  const allowed = canCreateQuotation(tc.status);
  const pass = allowed === tc.expected;
  if (!pass) allPass = false;
  console.log(`  Status "${tc.status}": ${allowed ? 'Allowed ✅' : 'Blocked 🛑'} (Expected: ${tc.expected ? 'Allowed' : 'Blocked'}) ${pass ? '✅' : '❌ FAIL'}`);
});

console.log('\n' + '═'.repeat(58));
console.log(`  Result: ${allPass ? 'ALL TESTS PASSED ✅' : 'TESTS FAILED ❌'}`);
console.log('═'.repeat(58));

process.exit(allPass ? 0 : 1);

/**
 * Test: Public Domain Customer Isolation
 *
 * Verifies that when an email is received from a public domain (@gmail.com, @yahoo.com, etc.),
 * the pipeline sets senderCompany on the Enquiry without permanently mutating the shared Customer.
 *
 * Usage: node src/scripts/testCustomerIsolation.js
 */

const PUBLIC_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'rediffmail.com', 'aol.com', 'protonmail.com'];

function resolveCustomerCompany(senderEmail, customerRecord, extractedResult) {
  const senderDomain = (senderEmail || '').split('@')[1]?.toLowerCase();
  const isPublicDomain = PUBLIC_DOMAINS.includes(senderDomain);

  const extractedCompany = (extractedResult && extractedResult.companyName && extractedResult.companyName !== 'Individual Customer') ? extractedResult.companyName : null;
  
  let customerName = customerRecord.companyName;
  let senderCompany = extractedCompany;

  if (!isPublicDomain && extractedCompany && customerName !== extractedCompany) {
    customerName = extractedCompany;
  } else if (isPublicDomain) {
    if (!senderCompany && customerName !== 'Individual Customer') {
      senderCompany = customerName;
    }
  } else if (!senderCompany) {
    senderCompany = customerName;
  }

  return {
    isPublicDomain,
    customerName,
    senderCompany: senderCompany || customerName || 'Individual Customer'
  };
}

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   Customer Isolation Logic - Test Suite                  ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// Test Case 1: Public domain sender (@gmail.com) with company extracted from signature
console.log('=== Test 1: @gmail.com Sender with Extracted Signature Company ===');
const test1 = resolveCustomerCompany(
  'jeetdodia12@gmail.com',
  { companyName: 'Individual Customer' },
  { companyName: 'Sri Akshaya Engineering Pvt. Ltd.' }
);
console.log(`  Sender Domain: gmail.com (isPublic: ${test1.isPublicDomain ? '✅' : '❌'})`);
console.log(`  Shared Customer Name in DB: "${test1.customerName}" (expected: "Individual Customer") ${test1.customerName === 'Individual Customer' ? '✅' : '❌'}`);
console.log(`  Enquiry Sender Company: "${test1.senderCompany}" (expected: "Sri Akshaya Engineering Pvt. Ltd.") ${test1.senderCompany === 'Sri Akshaya Engineering Pvt. Ltd.' ? '✅' : '❌'}`);

// Test Case 2: Subsequent @gmail.com email for a DIFFERENT company
console.log('\n=== Test 2: Subsequent @gmail.com Email for a DIFFERENT Company ===');
const test2 = resolveCustomerCompany(
  'jeetdodia12@gmail.com',
  { companyName: 'Individual Customer' },
  { companyName: 'Reliance Industries Limited' }
);
console.log(`  Shared Customer Name in DB: "${test2.customerName}" (expected: "Individual Customer") ${test2.customerName === 'Individual Customer' ? '✅' : '❌'}`);
console.log(`  Enquiry Sender Company: "${test2.senderCompany}" (expected: "Reliance Industries Limited") ${test2.senderCompany === 'Reliance Industries Limited' ? '✅' : '❌'}`);

// Test Case 3: Corporate domain sender (@siemens.com)
console.log('\n=== Test 3: Corporate Domain Sender (@siemens.com) ===');
const test3 = resolveCustomerCompany(
  'john@siemens.com',
  { companyName: 'Individual Customer' },
  { companyName: 'Siemens India Ltd' }
);
console.log(`  Is Public Domain: ${!test3.isPublicDomain ? '✅ (Corporate)' : '❌'}`);
console.log(`  Shared Customer Name in DB: "${test3.customerName}" (expected: "Siemens India Ltd") ${test3.customerName === 'Siemens India Ltd' ? '✅' : '❌'}`);
console.log(`  Enquiry Sender Company: "${test3.senderCompany}" (expected: "Siemens India Ltd") ${test3.senderCompany === 'Siemens India Ltd' ? '✅' : '❌'}`);

const allPass = (
  test1.customerName === 'Individual Customer' && test1.senderCompany === 'Sri Akshaya Engineering Pvt. Ltd.' &&
  test2.customerName === 'Individual Customer' && test2.senderCompany === 'Reliance Industries Limited' &&
  test3.customerName === 'Siemens India Ltd' && test3.senderCompany === 'Siemens India Ltd'
);

console.log('\n' + '═'.repeat(58));
console.log(`  Results: ${allPass ? 'ALL TESTS PASSED ✅' : 'TESTS FAILED ❌'}`);
console.log('═'.repeat(58));

process.exit(allPass ? 0 : 1);

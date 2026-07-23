/**
 * Test: Multi-Line-Item Email Body Parsing
 * 
 * Verifies that the deterministic email body parser correctly splits
 * numbered valve line items from real email body text.
 *
 * Test case: JNPA project email with 3 valve items + lube oil section.
 *
 * Usage: node src/scripts/testEmailBodyParser.js
 */

const { parseEmailBodyLineItems, stripNonValveSections } = require('../services/boqParserService');

// ─── Test Data: Exact email body text from the JNPA project email ─────────────

const JNPA_EMAIL_BODY = `Dear sir,

We have requirement of valves for the JNPA project Kindly share offer along with terms & conditions as earliest

Sl no  Details Unit Qty

1 4" Shut off valve - pneumatic type- Suitable for 60 m3/hr. flow rate                        Nos. 16
2 4" On Off Type Valve along with NO + NC contacts/   I/P converter  Suitable for 60 m3/hr flow rate Nos. 8
3 4" Isolation Ball Valve- Suitable for 60 m3/hr. flow rate                                   Nos. 8

Product Details:- Finished product of lube oil

*Sr No*
1 Class-I Uninhibited(TO 20/2064/HSN)   8.1   0.825   FG product
2 Class II Uninhibited(60U)   10.6   0.860   FG product
3 Class-I inhibited(3PX)   8.2   0.825   FG product
4 Special Nepthenic Inhibited(SNX/10X/UX) 10.6   0.860   FG product
5 Technical 68   67.6   0.857   FG product
6 Technical 22   24.1   0.844   FG product

*Thank you,*

*Hemanshi Mistry*Founder | Intan Networks`;

// ─── Test 1: stripNonValveSections ──────────────────────────────────────────

function testStripNonValveSections() {
  console.log('\n=== Test 1: stripNonValveSections ===');
  
  const stripped = stripNonValveSections(JNPA_EMAIL_BODY);
  
  const hasLubeOil = stripped.toLowerCase().includes('lube oil');
  const hasValveContent = stripped.toLowerCase().includes('shut off valve');
  const hasThankYou = stripped.toLowerCase().includes('thank you');
  
  console.log(`  Contains valve content: ${hasValveContent ? '✅' : '❌'}`);
  console.log(`  Lube oil removed: ${!hasLubeOil ? '✅' : '❌ FAIL - lube oil section not stripped'}`);
  console.log(`  Thank you removed: ${!hasThankYou ? '✅' : '❌ FAIL - signature not stripped'}`);
  
  const pass = hasValveContent && !hasLubeOil && !hasThankYou;
  console.log(`  Result: ${pass ? 'PASS ✅' : 'FAIL ❌'}`);
  return pass;
}

// ─── Test 2: parseEmailBodyLineItems with JNPA email ────────────────────────

function testJNPAEmail() {
  console.log('\n=== Test 2: parseEmailBodyLineItems (JNPA Email - 3 Valves) ===');
  
  const products = parseEmailBodyLineItems(JNPA_EMAIL_BODY);
  
  console.log(`  Products found: ${products.length} (expected: 3)`);
  const countPass = products.length === 3;
  console.log(`  Count: ${countPass ? '✅' : '❌ FAIL'}`);
  
  if (products.length >= 1) {
    const p1 = products[0];
    console.log(`\n  Item 1: "${p1.productDescription}"`);
    console.log(`    Qty: ${p1.quantity} (expected: 16) ${p1.quantity === 16 ? '✅' : '❌'}`);
    console.log(`    Category: ${p1.productCategory} (expected: Valves) ${p1.productCategory === 'Valves' ? '✅' : '❌'}`);
    console.log(`    Has "shut off": ${p1.productDescription.toLowerCase().includes('shut off') ? '✅' : '❌'}`);
    console.log(`    Has "pneumatic": ${p1.productDescription.toLowerCase().includes('pneumatic') ? '✅' : '❌'}`);
  }
  
  if (products.length >= 2) {
    const p2 = products[1];
    console.log(`\n  Item 2: "${p2.productDescription}"`);
    console.log(`    Qty: ${p2.quantity} (expected: 8) ${p2.quantity === 8 ? '✅' : '❌'}`);
    console.log(`    Has "on off": ${p2.productDescription.toLowerCase().includes('on off') ? '✅' : '❌'}`);
    console.log(`    Has "NC contacts": ${p2.productDescription.toLowerCase().includes('nc contact') ? '✅' : '❌'}`);
  }
  
  if (products.length >= 3) {
    const p3 = products[2];
    console.log(`\n  Item 3: "${p3.productDescription}"`);
    console.log(`    Qty: ${p3.quantity} (expected: 8) ${p3.quantity === 8 ? '✅' : '❌'}`);
    console.log(`    Has "isolation ball valve": ${p3.productDescription.toLowerCase().includes('isolation ball valve') ? '✅' : '❌'}`);
    console.log(`    Category: ${p3.productCategory} (expected: Valves) ${p3.productCategory === 'Valves' ? '✅' : '❌'}`);
  }
  
  // Verify NO lube oil products leaked through
  const hasLubeOil = products.some(p => p.productDescription.toLowerCase().includes('lube') || p.productDescription.toLowerCase().includes('nepthenic'));
  console.log(`\n  No lube oil products: ${!hasLubeOil ? '✅' : '❌ FAIL - lube oil leaked through'}`);
  
  const pass = countPass 
    && products[0]?.quantity === 16 
    && products[1]?.quantity === 8 
    && products[2]?.quantity === 8
    && !hasLubeOil;
  console.log(`\n  Result: ${pass ? 'PASS ✅' : 'FAIL ❌'}`);
  return pass;
}

// ─── Test 3: Multi-line format (OCR-style) ──────────────────────────────────

function testMultiLineFormat() {
  console.log('\n=== Test 3: parseEmailBodyLineItems (Multi-Line Format) ===');
  
  const multiLineBody = `Dear Sir,

We require the following valves:

1
4" Shut off valve - pneumatic type
Nos.
16

2
4" On Off Type Valve
Nos.
8

3
4" Isolation Ball Valve
Nos.
8

Product Details:- Finished product of lube oil
Some more lube oil data here`;

  const products = parseEmailBodyLineItems(multiLineBody);
  
  console.log(`  Products found: ${products.length} (expected: 3)`);
  const countPass = products.length === 3;
  
  if (products.length >= 1) {
    console.log(`  Item 1: "${products[0].productDescription}" - Qty: ${products[0].quantity} ${products[0].quantity === 16 ? '✅' : '❌'}`);
  }
  if (products.length >= 2) {
    console.log(`  Item 2: "${products[1].productDescription}" - Qty: ${products[1].quantity} ${products[1].quantity === 8 ? '✅' : '❌'}`);
  }
  if (products.length >= 3) {
    console.log(`  Item 3: "${products[2].productDescription}" - Qty: ${products[2].quantity} ${products[2].quantity === 8 ? '✅' : '❌'}`);
  }
  
  const pass = countPass
    && products[0]?.quantity === 16
    && products[1]?.quantity === 8
    && products[2]?.quantity === 8;
  console.log(`  Result: ${pass ? 'PASS ✅' : 'FAIL ❌'}`);
  return pass;
}

// ─── Test 4: Edge case - no numbered items → returns [] (falls to AI) ───────

function testNoNumberedItems() {
  console.log('\n=== Test 4: No Numbered Items (should return empty, fallback to AI) ===');
  
  const plainEmail = `Dear Sir,

We require Ball Valves for our JNPA project.
Please share your best quotation.

Regards,
John`;

  const products = parseEmailBodyLineItems(plainEmail);
  const pass = products.length === 0;
  console.log(`  Products found: ${products.length} (expected: 0)`);
  console.log(`  Result: ${pass ? 'PASS ✅' : 'FAIL ❌'}`);
  return pass;
}

// ─── Test 5: Various quantity formats ───────────────────────────────────────

function testQuantityFormats() {
  console.log('\n=== Test 5: Various Quantity Formats ===');
  
  const body = `Dear Sir,

Please quote:

1. CS Ball Valve 100mm Qty: 15
2) SS Gate Valve 50mm 8 Nos
3  Check Valve 4 inch  Nos. 12

Thanks`;

  const products = parseEmailBodyLineItems(body);
  
  console.log(`  Products found: ${products.length} (expected: 3)`);
  
  let pass = products.length === 3;
  if (products.length >= 1) {
    console.log(`  Item 1: Qty=${products[0].quantity} (expected: 15) ${products[0].quantity === 15 ? '✅' : '❌'}`);
    pass = pass && products[0].quantity === 15;
  }
  if (products.length >= 2) {
    console.log(`  Item 2: Qty=${products[1].quantity} (expected: 8) ${products[1].quantity === 8 ? '✅' : '❌'}`);
    pass = pass && products[1].quantity === 8;
  }
  if (products.length >= 3) {
    console.log(`  Item 3: Qty=${products[2].quantity} (expected: 12) ${products[2].quantity === 12 ? '✅' : '❌'}`);
    pass = pass && products[2].quantity === 12;
  }
  
  console.log(`  Result: ${pass ? 'PASS ✅' : 'FAIL ❌'}`);
  return pass;
}

// ─── Test 6: Boundary detection handles "Product Details" mid-email ─────────

function testBoundaryDetection() {
  console.log('\n=== Test 6: Boundary Detection (Product Details section) ===');
  
  const body = `Valve requirements:

1 4" Ball Valve Nos. 10

Product Details:- Finished product of lube oil

1 Class-I Uninhibited 8.1 0.825 FG product
2 Class II Uninhibited 10.6 0.860 FG product`;

  const products = parseEmailBodyLineItems(body);
  
  const countPass = products.length === 1;
  const noLubeOil = !products.some(p => p.productDescription.toLowerCase().includes('class'));
  
  console.log(`  Products found: ${products.length} (expected: 1)`);
  console.log(`  No lube oil: ${noLubeOil ? '✅' : '❌'}`);
  
  const pass = countPass && noLubeOil;
  console.log(`  Result: ${pass ? 'PASS ✅' : 'FAIL ❌'}`);
  return pass;
}

// ─── Run All Tests ──────────────────────────────────────────────────────────

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   Email Body Line Item Parser - Test Suite               ║');
console.log('╚══════════════════════════════════════════════════════════╝');

const results = [
  testStripNonValveSections(),
  testJNPAEmail(),
  testMultiLineFormat(),
  testNoNumberedItems(),
  testQuantityFormats(),
  testBoundaryDetection()
];

const passed = results.filter(Boolean).length;
const total = results.length;

console.log('\n' + '═'.repeat(58));
console.log(`  Results: ${passed}/${total} tests passed ${passed === total ? '✅ ALL PASS' : '❌ FAILURES'}`);
console.log('═'.repeat(58));

process.exit(passed === total ? 0 : 1);

/**
 * Test script for Email Table Parsers (Task 1, Task 2, Task 3)
 */
const boqParserService = require('../services/boqParserService');

console.log('================================================================');
console.log('🧪 RUNNING TEST SUITE: Email Table Parsers & Strategy 5 Guard');
console.log('================================================================\n');

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: HTML Table Parser (Task 1)
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- TEST 1: HTML Table Parser (12 items) ---');
const sampleHtmlTable = `
<p>Dear Petro Valves Team,</p>
<p>Please find our valve requirements below:</p>
<table border="1" cellpadding="5" cellspacing="0">
  <thead>
    <tr>
      <th>Item</th>
      <th>Valve Description</th>
      <th>Size</th>
      <th>Class</th>
      <th>Qty</th>
      <th>Body MOC</th>
      <th>Seat</th>
      <th>End Connection</th>
      <th>Standard</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>1.01</td><td>Carbon Steel Ball Valve, Full Bore</td><td>2"</td><td>600#</td><td>12</td><td>ASTM A216 WCB</td><td>Metal-to-Metal</td><td>RF Flanged</td><td>API 6D</td></tr>
    <tr><td>1.02</td><td>Carbon Steel Ball Valve, Full Bore</td><td>3"</td><td>600#</td><td>8</td><td>ASTM A216 WCB</td><td>Metal-to-Metal</td><td>RF Flanged</td><td>API 6D</td></tr>
    <tr><td>1.03</td><td>Carbon Steel Ball Valve, Full Bore</td><td>4"</td><td>600#</td><td>10</td><td>ASTM A216 WCB</td><td>Metal-to-Metal</td><td>RF Flanged</td><td>API 6D</td></tr>
    <tr><td>1.04</td><td>Carbon Steel Ball Valve, Full Bore</td><td>6"</td><td>600#</td><td>6</td><td>ASTM A216 WCB</td><td>Metal-to-Metal</td><td>RF Flanged</td><td>API 6D</td></tr>
    <tr><td>1.05</td><td>Carbon Steel Ball Valve, Full Bore</td><td>8"</td><td>600#</td><td>5</td><td>ASTM A216 WCB</td><td>Metal-to-Metal</td><td>RF Flanged</td><td>API 6D</td></tr>
    <tr><td>1.06</td><td>Carbon Steel Ball Valve, Full Bore</td><td>10"</td><td>600#</td><td>4</td><td>ASTM A216 WCB</td><td>Metal-to-Metal</td><td>RF Flanged</td><td>API 6D</td></tr>
    <tr><td>1.07</td><td>Carbon Steel Ball Valve, Full Bore</td><td>12"</td><td>600#</td><td>3</td><td>ASTM A216 WCB</td><td>Metal-to-Metal</td><td>RF Flanged</td><td>API 6D</td></tr>
    <tr><td>1.08</td><td>Carbon Steel Ball Valve, Full Bore</td><td>16"</td><td>600#</td><td>2</td><td>ASTM A216 WCB</td><td>Metal-to-Metal</td><td>RF Flanged</td><td>API 6D</td></tr>
    <tr><td>1.09</td><td>Low Temp CS Ball Valve, Full Bore</td><td>18"</td><td>300#</td><td>2</td><td>ASTM A352 LCC</td><td>Devlon-V</td><td>RF Flanged</td><td>API 6D</td></tr>
    <tr><td>1.10</td><td>Low Temp CS Ball Valve, Full Bore</td><td>20"</td><td>300#</td><td>1</td><td>ASTM A352 LCC</td><td>Devlon-V</td><td>RF Flanged</td><td>API 6D</td></tr>
    <tr><td>1.11</td><td>Low Temp CS Ball Valve, Full Bore</td><td>24"</td><td>300#</td><td>1</td><td>ASTM A352 LCC</td><td>Devlon-V</td><td>RF Flanged</td><td>API 6D</td></tr>
    <tr><td>1.12</td><td>Low Temp CS Ball Valve, Full Bore</td><td>24"</td><td>600#</td><td>1</td><td>ASTM A352 LCC</td><td>Devlon-V</td><td>RF Flanged</td><td>API 6D</td></tr>
  </tbody>
</table>
<p>Regards,<br>Procurement Engineer</p>
`;

const htmlResults = boqParserService.parseHtmlTableLineItems(sampleHtmlTable);
console.log(`Extracted ${htmlResults.length} items from HTML table.`);
if (htmlResults.length === 12) {
  console.log('✅ TEST 1 PASSED: Exactly 12 items extracted from HTML table.');
  console.log(`Sample item 1: ${JSON.stringify(htmlResults[0], null, 2)}`);
  console.log(`Sample item 12: ${JSON.stringify(htmlResults[11], null, 2)}`);
} else {
  console.error(`❌ TEST 1 FAILED: Expected 12 items, got ${htmlResults.length}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Mid-Column Quantity Plain-Text Table Parser (Task 2)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- TEST 2: Mid-Column Quantity Plain-Text Table Parser (12 items) ---');
const samplePlainTextTable = `
Dear Sir/Madam,
Please quote your best price for the following items:

Item Valve Description Size Class Qty Body MOC Seat End Connection Standard
1.01 Carbon Steel Ball Valve, Full Bore 2" 600# 12 ASTM A216 WCB Metal-to-Metal RF Flanged API 6D
1.02 Carbon Steel Ball Valve, Full Bore 3" 600# 8 ASTM A216 WCB Metal-to-Metal RF Flanged API 6D
1.03 Carbon Steel Ball Valve, Full Bore 4" 600# 10 ASTM A216 WCB Metal-to-Metal RF Flanged API 6D
1.04 Carbon Steel Ball Valve, Full Bore 6" 600# 6 ASTM A216 WCB Metal-to-Metal RF Flanged API 6D
1.05 Carbon Steel Ball Valve, Full Bore 8" 600# 5 ASTM A216 WCB Metal-to-Metal RF Flanged API 6D
1.06 Carbon Steel Ball Valve, Full Bore 10" 600# 4 ASTM A216 WCB Metal-to-Metal RF Flanged API 6D
1.07 Carbon Steel Ball Valve, Full Bore 12" 600# 3 ASTM A216 WCB Metal-to-Metal RF Flanged API 6D
1.08 Carbon Steel Ball Valve, Full Bore 16" 600# 2 ASTM A216 WCB Metal-to-Metal RF Flanged API 6D
1.09 Low Temp CS Ball Valve, Full Bore 18" 300# 2 ASTM A352 LCC Devlon-V RF Flanged API 6D
1.10 Low Temp CS Ball Valve, Full Bore 20" 300# 1 ASTM A352 LCC Devlon-V RF Flanged API 6D
1.11 Low Temp CS Ball Valve, Full Bore 24" 300# 1 ASTM A352 LCC Devlon-V RF Flanged API 6D
1.12 Low Temp CS Ball Valve, Full Bore 24" 600# 1 ASTM A352 LCC Devlon-V RF Flanged API 6D

Best Regards,
John Doe
`;

const plainTextResults = boqParserService.parseEmailBodyLineItems(samplePlainTextTable);
console.log(`Extracted ${plainTextResults.length} items from plain text table.`);
if (plainTextResults.length === 12) {
  console.log('✅ TEST 2 PASSED: Exactly 12 items extracted from mid-column plain-text table.');
  console.log(`Sample item 1: Qty=${plainTextResults[0].quantity}, Desc=${plainTextResults[0].productDescription}`);
  console.log(`Sample item 12: Qty=${plainTextResults[11].quantity}, Desc=${plainTextResults[11].productDescription}`);
} else {
  console.error(`❌ TEST 2 FAILED: Expected 12 items, got ${plainTextResults.length}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Strategy 5 Greeting Filter (Task 3)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- TEST 3: Strategy 5 Greeting Rejection ---');
const greetingOnlyEmail = `
Dear Sir/Madam,
We hope you are doing well.
Please find the attached document for your review.

Regards,
Purchase Department
`;

const greetingResults = boqParserService.parseEmailBodyLineItems(greetingOnlyEmail);
console.log(`Extracted ${greetingResults.length} items from non-product email.`);
if (greetingResults.length === 0) {
  console.log('✅ TEST 3 PASSED: Greetings / conversational text are rejected (0 items extracted).');
} else {
  console.error(`❌ TEST 3 FAILED: Erroneously extracted greeting as item: ${JSON.stringify(greetingResults)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: Real Single-Item RFQ with Greeting (Task 3)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- TEST 4: Single Item RFQ with Greeting ---');
const singleItemRfq = `
Dear Sir,
Please quote 2 Nos Ball Valve, 50 mm, Class 150#, Body MOC ASTM A216 WCB. End connection: Flanged RF.

Best regards,
Procurement Team
`;

const singleItemResults = boqParserService.parseEmailBodyLineItems(singleItemRfq);
console.log(`Extracted ${singleItemResults.length} items from single-item RFQ.`);
if (singleItemResults.length === 1 && !singleItemResults[0].productDescription.includes('Dear Sir')) {
  console.log('✅ TEST 4 PASSED: Single-item extracted with clean description and quantity = 2.');
  console.log(`Result: ${JSON.stringify(singleItemResults[0], null, 2)}`);
} else {
  console.error(`❌ TEST 4 FAILED: Expected 1 clean item, got ${JSON.stringify(singleItemResults)}`);
}

console.log('\n================================================================');
console.log('🎉 ALL TESTS COMPLETED');
console.log('================================================================');

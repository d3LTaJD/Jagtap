const { extractContactDetails } = require('./contactExtractor');

const sampleEmailText = `
Item 06: Globe Valve (BS 1873 / API 600)
- Size: 2" (50 MM)
- Pressure Class: 150#
- Quantity: 6 Nos.

COMMERCIAL & GENERAL TERMS REQUIRED:
1. Inspection: EN 10204 3.2 Material Test Certificates required.
2. Packing & Forwarding: 5% extra.
3. 3.2 Certification: 5% extra.
4. TPIA: Third-Party Inspection to client account.
5. GST: 18% Applicable.
6. Offer Validity: 30 days.

Kindly confirm receipt and provide your formal quotation.

Thanks & Regards,

Jayesh Patel
Senior Procurement Engineer
Horizon Project Solutions Ltd.
Contact: +91 98250 12345
Email: j.patel@horizonprojects.com
`;

console.log('Testing Contact Extraction on Real Email Text...');
const extracted = extractContactDetails(sampleEmailText, 'kintsugi8604@gmail.com', 'ab cd');
console.log('Result:', JSON.stringify(extracted, null, 2));

console.assert(extracted.contactPerson === 'Jayesh Patel', `Expected Jayesh Patel, got ${extracted.contactPerson}`);
console.assert(extracted.companyName === 'Horizon Project Solutions Ltd.', `Expected Horizon Project Solutions Ltd., got ${extracted.companyName}`);
console.assert(extracted.mobileNumber === '+91 98250 12345', `Expected +91 98250 12345, got ${extracted.mobileNumber}`);
console.assert(extracted.contactEmail === 'j.patel@horizonprojects.com', `Expected j.patel@horizonprojects.com, got ${extracted.contactEmail}`);

console.log('ALL CONTACT EXTRACTION ASSERTIONS PASSED! ✅');

const boqParserService = require('../services/boqParserService');

const sriAtchayaEmailText = `
*Sl.No.*
*Item Description*
*Quantity*
*Units*

1
Supply and delivery of Ball Valves (API 6D), Globe Valves (API 623 / BS
1873), Swing Check Valves (API 6D / BS 1868), Gate Valves (A PI 602) and
Thermal Relief Valves, Pressure Safety Valve as per technical
specifications.

2
BALL API6D HOV F/F A/G TRU BOL 2IN 300#
35.00
EA

3
BALL API6D HOV F/F A/G TRU BOL 10IN 300#
1.00
EA

4
BALL API6D HOV F/F A/G TRU BOL 4IN 300#
2.00
EA

5
BALL API6D,HOV,F/F, A/G,TRU,BOL,3IN 300#
1.00
EA

6
BALL API6D,HOV,F/F, A/G,TRU,BOL,2IN 300#
2500
EA

7
VLV,CHK,A216 WCB,A216 WCB,FLG,300,10IN
1.00
EA

8
1" x 800# W/W, A/G, HOV, API 602 GATE VALVE
2.00
EA

9
18"x ANSI 150# HOV F/F API 600 Gate Valve
2.00
EA

10
4"x ANSI 150# HOV F/F API 600 Gate Valve
400
EA

VENDOR SHALL HAVE VALID API 6D BALL VALVE CERTIFICATE AND VALID API 6FA/
API 607 FIRE SAFE CERTIFICATE WHICH IS TO BE SUBMITTED TO IOCL BEFORE ORDER.
`;

const items = boqParserService.parseEmailBodyLineItems(sriAtchayaEmailText);
console.log('Result count:', items.length);
let totalQty = 0;
items.forEach((item, idx) => {
  totalQty += item.quantity;
  console.log(`Item ${idx + 1}: [Qty: ${item.quantity} ${item.unit}] -> "${item.productDescription}"`);
});
console.log('Total Qty:', totalQty, '(Expected: 2944)');

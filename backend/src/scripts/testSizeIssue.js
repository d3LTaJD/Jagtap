const extractorRegistry = require('../services/extraction/ExtractorRegistry');
const tokenizer = require('../services/extraction/Tokenizer');

const testDescs = [
  { text: 'BALL API6D HOV F/F A/G TRU BOL 2IN 300#', expSize: '50 mm', expClass: '300#', expType: 'Ball Valve' },
  { text: 'BALL API6D HOV F/F A/G TRU BOL 10IN 300#', expSize: '250 mm', expClass: '300#', expType: 'Ball Valve' },
  { text: 'BALL API6D HOV F/F A/G TRU BOL 4IN 300#', expSize: '100 mm', expClass: '300#', expType: 'Ball Valve' },
  { text: 'BALL API6D,HOV,F/F, A/G,TRU,BOL,3IN 300#', expSize: '80 mm', expClass: '300#', expType: 'Ball Valve' },
  { text: 'BALL API6D,HOV,F/F, A/G,TRU,BOL,2IN 300#', expSize: '50 mm', expClass: '300#', expType: 'Ball Valve' },
  { text: 'VLV,CHK,A216 WCB,A216 WCB,FLG,300,10IN', expSize: '250 mm', expClass: '300#', expType: 'Check Valve' },
  { text: '1" x 800# W/W, A/G, HOV, API 602 GATE VALVE', expSize: '25 mm', expClass: '800#', expType: 'Gate Valve' },
  { text: '18"x ANSI 150# HOV F/F API 600 Gate Valve', expSize: '450 mm', expClass: '150#', expType: 'Gate Valve' },
  { text: '4"x ANSI 150# HOV F/F API 600 Gate Valve', expSize: '100 mm', expClass: '150#', expType: 'Gate Valve' }
];

console.log('Testing all 9 Sri Atchaya Valve Descriptions:');
let passed = 0;
testDescs.forEach((d, idx) => {
  const tok = tokenizer.tokenize(d.text);
  const res = extractorRegistry.runAll(tok);
  const size = res.SizeExtractor?.normalizedValue;
  const cls = res.ClassExtractor?.normalizedValue;
  const type = res.ValveExtractor?.normalizedValue;

  const sizeOk = size === d.expSize;
  const classOk = cls === d.expClass;
  const typeOk = type === d.expType;

  if (sizeOk && classOk && typeOk) {
    passed++;
    console.log(`[PASS] Item ${idx + 1}: ${d.text} -> ${size} | ${cls} | ${type}`);
  } else {
    console.error(`[FAIL] Item ${idx + 1}: ${d.text}`);
    console.error(`       Size: ${size} (expected: ${d.expSize})`);
    console.error(`       Class: ${cls} (expected: ${d.expClass})`);
    console.error(`       Type: ${type} (expected: ${d.expType})`);
  }
});

console.log(`\nResults: ${passed}/${testDescs.length} items passed!`);

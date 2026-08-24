const extractorRegistry = require('../services/extraction/ExtractorRegistry');

const descriptions = [
  "Valve, Ball, API6D, TM, FB BW #600, 250 mm (10’’) UG (with PUP Piece)",
  "Valve, Ball, API6D, TM, FB BW #150, 250 mm (10’’) UG (with PUP Piece)",
  "Valve, Ball, API6D, TM, FB BW #300, 250 mm (10’’) UG (with PUP Piece)",
  "Valve, Ball, API6D, TM, FB BW #150, 150 mm (6’’) UG (with PUP Piece)",
  "Valve, Ball, API6D, TM, FB BW #300, 150 mm (6’’) UG (with PUP Piece)",
  "Valve, Ball, API6D, TM, FB BW #300, 100 mm (4’’) UG (with PUP Piece)",
  "Valve, Ball, API6D, TM, FB BW #150, 100 mm (4’’) UG (with PUP Piece)",
  "Valve, Ball, API6D, TM, FB BW #600, 50 mm (2’’) UG",
  "Valve, Ball, API6D, TM, FB BW #300, 50 mm (2’’) UG",
  "Valve, Ball, API6D, TM, FB BW #150, 50 mm (2’’) UG",
  "Valve, Ball, BS5359, FB SW 800#, 25 mm (1’’)",
  "Valve, Ball, BS5359, FB SW #800, 20 mm (3/4’’)"
];

console.log('=== EXTRACTOR REGISTRY TEST ON 12 BOQ ITEMS ===\n');

descriptions.forEach((desc, i) => {
  const result = extractorRegistry.runAll(desc);
  console.log(`\nItem ${i + 1}: ${desc}`);
  console.log('  Valve:', result.valve?.map(v => v.value));
  console.log('  Size:', result.size?.map(s => s.value));
  console.log('  Class:', result.class?.map(c => c.value));
  console.log('  Standard:', result.standard?.map(st => st.value));
});

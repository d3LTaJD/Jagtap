const deterministicExtractionService = require('../services/extraction/DeterministicExtractionService');
const normalizationService = require('../services/extraction/NormalizationService');

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

console.log('=== TESTING FAST DETERMINISTIC EXTRACTION ON 12 BOQ ITEMS ===\n');

descriptions.forEach((desc, i) => {
  const extracted = deterministicExtractionService.extractDeterministicFields(desc);
  console.log(`Item ${i + 1}: ${desc}`);
  console.log('  Extracted:', {
    valve_type: extracted.valve_type?.value,
    valve_size: extracted.valve_size?.value,
    valve_class: extracted.valve_class?.value,
    valve_end_connection: extracted.valve_end_connection?.value,
    valve_bore: extracted.valve_bore?.value,
    valve_moc_body: extracted.valve_moc_body?.value
  });
});

/**
 * Benchmark Runner for Zero-Hallucination Extraction Pipeline
 * Loads test case files from benchmark/cases/ and runs each through
 * the regex extraction pipeline. Reports field-level accuracy metrics.
 *
 * Usage: node src/scripts/benchmark/runner.js
 */

const fs = require('fs');
const path = require('path');

const extractorRegistry = require('../../services/extraction/ExtractorRegistry');
const tokenizer = require('../../services/extraction/Tokenizer');
const validationEngine = require('../../services/extraction/ValidationEngine');
const consistencyChecker = require('../../services/extraction/ConsistencyChecker');

// Resolve field from regex extractions
function resolveField(regexResults, fieldName) {
  const lower = fieldName.toLowerCase();
  if (lower.includes('type') && lower.includes('valve')) return regexResults.ValveExtractor?.normalizedValue || null;
  if (lower.includes('size')) return regexResults.SizeExtractor?.normalizedValue || null;
  if (lower.includes('class')) return regexResults.ClassExtractor?.normalizedValue || null;
  if (lower.includes('material')) return regexResults.MaterialExtractor?.normalizedValue || null;
  if (lower.includes('end') || lower.includes('connection')) return regexResults.EndConnectionExtractor?.normalizedValue || null;
  if (lower.includes('qty') || lower.includes('quantity')) return regexResults.QuantityExtractor?.normalizedValue || null;
  if (lower.includes('standard')) return regexResults.StandardExtractor?.normalizedValue || null;
  return null;
}

function runBenchmark() {
  const casesDir = path.join(__dirname, 'cases');

  if (!fs.existsSync(casesDir)) {
    console.error('No benchmark/cases/ directory found.');
    process.exit(1);
  }

  const caseFiles = fs.readdirSync(casesDir).filter(f => f.endsWith('.json'));
  if (caseFiles.length === 0) {
    console.error('No benchmark case files found.');
    process.exit(1);
  }

  console.log('===============================================================');
  console.log('🏁 BENCHMARK RUNNER — Zero-Hallucination Extraction Pipeline');
  console.log('===============================================================\n');

  let totalCases = 0;
  let totalFields = 0;
  let correctFields = 0;
  let incorrectFields = 0;
  let nullCorrect = 0; // Correctly returned null for missing field
  let falsePositives = 0; // Extracted a value when null was expected
  let falseNegatives = 0; // Returned null when a value was expected

  const failures = [];

  for (const file of caseFiles) {
    const filePath = path.join(casesDir, file);
    const cases = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    console.log(`📂 ${file} (${cases.length} cases)`);

    for (const testCase of cases) {
      totalCases++;

      // Run tokenizer + extraction
      const tokenized = tokenizer.tokenize(testCase.input);
      const regexResults = extractorRegistry.runAll(tokenized);

      const expected = testCase.expected;

      for (const [fieldKey, expectedValue] of Object.entries(expected)) {
        // Skip meta-fields
        if (fieldKey.endsWith('_rejected')) continue;

        totalFields++;
        const actual = resolveField(regexResults, fieldKey);

        // Handle class rejection edge case
        if (expected[`${fieldKey}_rejected`] === true) {
          if (actual === null || actual === undefined) {
            correctFields++;
            nullCorrect++;
          } else {
            // Validate to check if it gets rejected
            const valRes = validationEngine.validateField(fieldKey, actual);
            if (valRes.state === 'INVALID') {
              correctFields++;
            } else {
              incorrectFields++;
              falsePositives++;
              failures.push({ caseId: testCase.id, field: fieldKey, expected: 'REJECTED', actual });
            }
          }
          continue;
        }

        if (expectedValue === null) {
          if (actual === null || actual === undefined) {
            correctFields++;
            nullCorrect++;
          } else {
            incorrectFields++;
            falsePositives++;
            failures.push({ caseId: testCase.id, field: fieldKey, expected: null, actual });
          }
        } else {
          if (actual === expectedValue) {
            correctFields++;
          } else if (actual === null || actual === undefined) {
            incorrectFields++;
            falseNegatives++;
            failures.push({ caseId: testCase.id, field: fieldKey, expected: expectedValue, actual: null });
          } else {
            incorrectFields++;
            failures.push({ caseId: testCase.id, field: fieldKey, expected: expectedValue, actual });
          }
        }
      }
    }
  }

  // Consistency checks
  console.log('\n--- Consistency Checks ---');
  const consistentText = '4" Ball Valve DN100 Class 300';
  const conCheck = consistencyChecker.checkConsistency(consistentText);
  console.log(`  "${consistentText}" → Consistent: ${conCheck.isConsistent}`);

  const inconsistentText = '4" Ball Valve 150 mm Class 300';
  const inconCheck = consistencyChecker.checkConsistency(inconsistentText);
  console.log(`  "${inconsistentText}" → Consistent: ${inconCheck.isConsistent} ${!inconCheck.isConsistent ? '(conflicts: ' + inconCheck.conflicts.map(c => c.message).join('; ') + ')' : ''}`);

  // Summary
  const accuracy = totalFields > 0 ? Math.round((correctFields / totalFields) * 100 * 10) / 10 : 100;
  const fpRate = totalFields > 0 ? Math.round((falsePositives / totalFields) * 100 * 10) / 10 : 0;
  const fnRate = totalFields > 0 ? Math.round((falseNegatives / totalFields) * 100 * 10) / 10 : 0;

  console.log('\n===============================================================');
  console.log('📊 BENCHMARK RESULTS');
  console.log('===============================================================');
  console.log(`  Total Cases:        ${totalCases}`);
  console.log(`  Total Fields:       ${totalFields}`);
  console.log(`  Correct:            ${correctFields} (${accuracy}%)`);
  console.log(`  Incorrect:          ${incorrectFields}`);
  console.log(`  Null Correct:       ${nullCorrect} (correctly returned null)`);
  console.log(`  False Positives:    ${falsePositives} (${fpRate}%) — extracted when null expected`);
  console.log(`  False Negatives:    ${falseNegatives} (${fnRate}%) — null when value expected`);
  console.log('===============================================================\n');

  if (failures.length > 0) {
    console.log('❌ FAILURES:');
    failures.forEach(f => {
      console.log(`  [${f.caseId}] ${f.field}: expected="${f.expected}" got="${f.actual}"`);
    });
  } else {
    console.log('🎉 ALL BENCHMARK CASES PASSED!');
  }

  process.exit(failures.length > 0 ? 1 : 0);
}

runBenchmark();

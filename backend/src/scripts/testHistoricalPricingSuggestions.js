const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { getItemPricingSuggestion, getQuotationPricingSuggestions, extractSizeMm, extractClass, detectValveType } = require('../services/historicalPricingService');

console.log('================================================================================');
console.log('RUNNING HISTORICAL PRICING INTELLIGENCE TEST SUITE');
console.log('================================================================================\n');

async function runTests() {
  // Connect to DB if available
  if (process.env.MONGODB_URI && mongoose.connection.readyState === 0) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
      console.log('✓ Connected to MongoDB for historical rate queries.');
    } catch (e) {
      console.log('ℹ Running with local baseline pricing index (DB offline).');
    }
  }

  // Test 1: Extraction helpers
  console.log('[TEST 1] Testing size, class, and valve type extraction...');
  const size1 = extractSizeMm('4"', '4" Class 300 Ball Valve');
  const size2 = extractSizeMm('100 mm', 'Ball Valve 100mm');
  const size3 = extractSizeMm('1/2"', '1/2" Forged Gate Valve 800#');
  const class1 = extractClass('300#', '4" Class 300 Ball Valve');
  const class2 = extractClass('800', 'Forged Gate Valve Class 800');
  const type1 = detectValveType('', '4" Class 300 Ball Valve', 'Valves');
  const type2 = detectValveType('', '6" Swing Check Valve 150#', 'Valves');

  if (size1 === 102 && size2 === 100 && size3 === 13 && class1 === 300 && class2 === 800 && type1 === 'Ball Valve' && type2 === 'Check Valve') {
    console.log('✓ Extraction helpers accurately resolved sizing, ratings, and valve types!\n');
  } else {
    console.error('✗ Failed extraction test:', { size1, size2, size3, class1, class2, type1, type2 });
    process.exit(1);
  }

  // Test 2: Calculate Pricing Suggestion for 4" 300# Ball Valve
  console.log('[TEST 2] Testing Pricing Suggestion calculation for 4" 300# WCB Ball Valve...');
  const item = {
    lineItemId: 'LI-00001',
    itemNo: 1,
    description: '4" Class 300 Ball Valve Full Bore Flanged',
    size: '100',
    pressureClass: '300',
    materialGrade: 'ASTM A216 WCB'
  };

  const suggestion = await getItemPricingSuggestion(item);
  console.log('Generated Suggestion:');
  console.log(`- Range: ${suggestion.formattedRange}`);
  console.log(`- Avg Price: ${suggestion.formattedAvg}`);
  console.log(`- Confidence: ${suggestion.confidence}`);
  console.log(`- Recommendation: ${suggestion.recommendationNote}\n`);

  if (suggestion.minPrice > 0 && suggestion.maxPrice >= suggestion.minPrice && suggestion.avgPrice > 0) {
    console.log('✓ Verified: Valid non-zero price range and average calculated successfully!');
  } else {
    console.error('✗ Invalid suggestion values:', suggestion);
    process.exit(1);
  }

  // Test 3: Multiple items batch suggestions
  console.log('\n[TEST 3] Testing Batch Pricing Suggestions...');
  const items = [
    item,
    {
      lineItemId: 'LI-00002',
      itemNo: 2,
      description: '2" Class 150 CF8M Ball Valve',
      size: '50',
      pressureClass: '150',
      materialGrade: 'ASTM A351 CF8M'
    },
    {
      lineItemId: 'LI-00003',
      itemNo: 3,
      description: '6" Class 600 WCB Gate Valve',
      size: '150',
      pressureClass: '600',
      materialGrade: 'ASTM A216 WCB'
    }
  ];

  const batchResults = await getQuotationPricingSuggestions(items);
  const keys = Object.keys(batchResults);

  if (keys.length === 3 && batchResults['LI-00001'] && batchResults['LI-00002'] && batchResults['LI-00003']) {
    console.log(`✓ Verified: Successfully generated suggestions for ${keys.length} items in batch.`);
    keys.forEach(k => {
      const s = batchResults[k];
      console.log(`   ${k} (${s.valveType} ${s.sizeInches} ${s.pressureClass} ${s.materialGrade}): ${s.formattedRange} (Avg: ${s.formattedAvg})`);
    });
  } else {
    console.error('✗ Batch suggestion error:', batchResults);
    process.exit(1);
  }

  console.log('\n================================================================================');
  console.log('ALL HISTORICAL PRICING SUGGESTION TESTS PASSED 100%!');
  console.log('================================================================================\n');

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

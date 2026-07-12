const fs = require('fs');
const content = fs.readFileSync('d:/jagtap/workflow-automation/backend/src/services/queueHandlers.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('products') || line.includes('newlyExtractedGlobal') || line.includes('backfill')) {
    console.log(`${i + 1}: ${line}`);
  }
});

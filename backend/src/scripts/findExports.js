const fs = require('fs');
const content = fs.readFileSync('d:/jagtap/workflow-automation/backend/src/services/aiService.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('module.exports') || line.includes('exports.')) {
    console.log(`${i + 1}: ${line}`);
  }
});

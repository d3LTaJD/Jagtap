const fs = require('fs');
const content = fs.readFileSync('d:/jagtap/workflow-automation/backend/src/scripts/seedPipingFields.js', 'utf8');
const regex = /fieldName:\s*'([^']+)'/g;
let match;
const fields = new Set();
while ((match = regex.exec(content)) !== null) {
  fields.add(match[1]);
}
console.log('Fields seeded:', Array.from(fields));

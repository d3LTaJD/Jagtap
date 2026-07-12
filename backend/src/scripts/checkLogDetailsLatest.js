const fs = require('fs');
const path = require('path');

const logDir = 'd:/jagtap/workflow-automation/backend/logs/ai/';
const files = fs.readdirSync(logDir)
  .filter(f => f.startsWith('20260712_053') && f.endsWith('.json'))
  .sort();

console.log(`Found ${files.length} log files for task-11901.`);

files.forEach((f, index) => {
  const filePath = path.join(logDir, f);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const rawVal = data.response?.body?.choices?.[0]?.message?.content;
  if (!rawVal) return;
  const responseJson = JSON.parse(rawVal.trim().replace(/^```json/, '').replace(/```$/, ''));
  console.log(`[Item ${index + 1}] File: ${f}\n   AI Raw valve_size:`, responseJson.valve_size);
});

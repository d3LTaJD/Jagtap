const fs = require('fs');
const path = require('path');

const logDir = 'd:/jagtap/workflow-automation/backend/logs/ai';
const files = fs.readdirSync(logDir).filter(f => f.startsWith('20260712_051') && f.endsWith('.json'));

for (const file of files) {
  const filePath = path.join(logDir, file);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const itemFocus = data.request?.prompt?.match(/We are extracting specifications specifically for this product item: "([^"]+)"/)?.[1];
    const rawVal = data.response?.body?.choices?.[0]?.message?.content;
    const responseJson = JSON.parse(rawVal.trim().replace(/^```json/, '').replace(/```$/, ''));
    console.log(`File: ${file}\n  Focus: ${itemFocus}\n  Extracted Size: ${JSON.stringify(responseJson.valve_size)}`);
  } catch (err) {
    // console.error(file, err.message);
  }
}

const fs = require('fs');
const path = require('path');

const logDir = 'd:/jagtap/workflow-automation/backend/logs/ai';
// Let's filter files that were created in task-11754
const files = [
  '20260712_051045_ENQ-2026-07-0014_AI_Dynamic_Extraction_OpenAI_Attempt1.json', // 1/2"
  '20260712_051103_ENQ-2026-07-0014_AI_Dynamic_Extraction_OpenAI_Attempt1.json', // 1/2"
  '20260712_051121_ENQ-2026-07-0014_AI_Dynamic_Extraction_OpenAI_Attempt1.json', // 3/4"
  '20260712_051139_ENQ-2026-07-0014_AI_Dynamic_Extraction_OpenAI_Attempt1.json', // 3/4"
  '20260712_051200_ENQ-2026-07-0014_AI_Dynamic_Extraction_OpenAI_Attempt1.json', // 1"
  '20260712_051222_ENQ-2026-07-0014_AI_Dynamic_Extraction_OpenAI_Attempt1.json', // 1"
  '20260712_051243_ENQ-2026-07-0014_AI_Dynamic_Extraction_OpenAI_Attempt1.json', // 3"
  '20260712_051304_ENQ-2026-07-0014_AI_Dynamic_Extraction_OpenAI_Attempt1.json', // 4"
  '20260712_051325_ENQ-2026-07-0014_AI_Dynamic_Extraction_OpenAI_Attempt1.json', // 4"
  '20260712_051347_ENQ-2026-07-0014_AI_Dynamic_Extraction_OpenAI_Attempt1.json', // Globe 3/4"
  '20260712_051408_ENQ-2026-07-0014_AI_Dynamic_Extraction_OpenAI_Attempt1.json', // Globe 3/4"
  '20260712_051429_ENQ-2026-07-0014_AI_Dynamic_Extraction_OpenAI_Attempt1.json', // Globe 1"
  '20260712_051446_ENQ-2026-07-0014_AI_Dynamic_Extraction_OpenAI_Attempt1.json', // Globe 1"
  '20260712_051504_ENQ-2026-07-0014_AI_Dynamic_Extraction_OpenAI_Attempt1.json'  // Check 4"
];

for (const file of files) {
  const filePath = path.join(logDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${file}`);
    continue;
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const itemFocus = data.request?.prompt?.match(/We are extracting specifications specifically for this product item: "([^"]+)"/)?.[1];
    const rawVal = data.response?.body?.choices?.[0]?.message?.content;
    const responseJson = JSON.parse(rawVal.trim().replace(/^```json/, '').replace(/```$/, ''));
    console.log(`File: ${file}\n  Focus: ${itemFocus}\n  AI Raw Size: ${JSON.stringify(responseJson.valve_size)}`);
  } catch (err) {
    console.log(`Error parsing ${file}: ${err.message}`);
  }
}

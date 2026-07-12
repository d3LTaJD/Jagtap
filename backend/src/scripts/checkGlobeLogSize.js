const fs = require('fs');
const files = [
  '20260712_052752_ENQ-2026-07-0014_AI_Dynamic_Extraction_OpenAI_Attempt1.json', // Item 10
  '20260712_052815_ENQ-2026-07-0014_AI_Dynamic_Extraction_OpenAI_Attempt1.json', // Item 11
  '20260712_052837_ENQ-2026-07-0014_AI_Dynamic_Extraction_OpenAI_Attempt1.json', // Item 12
  '20260712_052856_ENQ-2026-07-0014_AI_Dynamic_Extraction_OpenAI_Attempt1.json'  // Item 13
];

files.forEach(f => {
  const filePath = `d:/jagtap/workflow-automation/backend/logs/ai/${f}`;
  if (!fs.existsSync(filePath)) {
    console.log(`${f} does not exist`);
    return;
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const rawVal = data.response?.body?.choices?.[0]?.message?.content;
  const responseJson = JSON.parse(rawVal.trim().replace(/^```json/, '').replace(/```$/, ''));
  console.log(`${f} -> valve_size:`, responseJson.valve_size);
});

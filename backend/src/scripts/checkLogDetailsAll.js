const fs = require('fs');
const path = require('path');

const logDir = 'd:/jagtap/workflow-automation/backend/logs/ai/';
const files = fs.readdirSync(logDir)
  .filter(f => f.startsWith('20260712_052') && f.endsWith('.json'))
  .sort();

console.log(`Found ${files.length} log files for current run.`);

const options = [
  '15',   '20',   '25',   '32',
  '40',   '50',   '65',   '80',
  '100',  '150',  '200',  '250',
  '300',  '350',  '400',  '450',
  '500',  '550',  '600',  '650',
  '700',  '750',  '800',  '850',
  '900',  '950',  '1000', '1050',
  '1200', '1350', '1400', '1500'
];

const inchToMmMap = {
  '1/2': '15',
  '3/4': '20',
  '1': '25',
  '2': '50',
  '20': '500'
};

files.forEach((f, index) => {
  const filePath = path.join(logDir, f);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const rawVal = data.response?.body?.choices?.[0]?.message?.content;
  if (!rawVal) return;
  const responseJson = JSON.parse(rawVal.trim().replace(/^```json/, '').replace(/```$/, ''));
  
  const val = responseJson.valve_size?.value;
  if (!val) {
    console.log(`[Item ${index + 1}] File: ${f} -> No valve_size extracted`);
    return;
  }

  let matchVal = val;
  const normalizeStr = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const valNormalized = normalizeStr(val);

  const directMatch = options.find(opt => normalizeStr(opt) === valNormalized);
  if (directMatch) {
    matchVal = directMatch;
  } else {
    const cleanVal = String(val).toLowerCase().replace(/(?:inch|inches|nb|mm|["'\s])+/g, '').trim();
    if (inchToMmMap[cleanVal]) {
      matchVal = inchToMmMap[cleanVal];
    }
  }

  const matchedOpt = options.find(opt => {
    const nOpt = normalizeStr(opt);
    const nVal = normalizeStr(matchVal);
    if (nOpt === nVal) return true;
    if (nOpt.includes(nVal) || nVal.includes(nOpt)) return true;
    return false;
  });

  console.log(`[Item ${index + 1}] File: ${f}\n   AI Raw: "${val}" -> Normalized matchVal: "${matchVal}" -> matchedOpt: "${matchedOpt}"`);
});

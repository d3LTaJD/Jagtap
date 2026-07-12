const fs = require('fs');
const path = require('path');

const inchToMmMap = {
  '1/2': '15',
  '3/4': '20',
  '1': '25',
  '1.25': '32',
  '1.1/4': '32',
  '1-1/4': '32',
  '1.5': '40',
  '1.1/2': '40',
  '1-1/2': '40',
  '2': '50',
  '2.5': '65',
  '2.1/2': '65',
  '2-1/2': '65',
  '3': '80',
  '4': '100',
  '5': '125',
  '6': '150',
  '8': '200',
  '10': '250',
  '12': '300',
  '14': '350',
  '16': '400',
  '18': '450',
  '20': '500',
  '24': '600'
};

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

const logDir = 'd:/jagtap/workflow-automation/backend/logs/ai';
const files = fs.readdirSync(logDir).filter(f => f.startsWith('20260712_051') && f.endsWith('.json'));

for (const file of files) {
  const filePath = path.join(logDir, file);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const itemFocus = data.request?.prompt?.match(/We are extracting specifications specifically for this product item: "([^"]+)"/)?.[1];
    const rawVal = data.response?.body?.choices?.[0]?.message?.content;
    const responseJson = JSON.parse(rawVal.trim().replace(/^```json/, '').replace(/```$/, ''));
    
    const val = responseJson.valve_size?.value;
    if (!val) continue;

    let matchVal = val;
    const normalizeStr = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
    const valNormalized = normalizeStr(val);
    
    // If the value already matches one of the options directly, don't try to convert it!
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

    console.log(`File: ${file}\n  Focus: ${itemFocus}\n  AI Extracted: ${val} -> matchVal: ${matchVal} -> matchedOpt: ${matchedOpt}`);
  } catch (err) {
    // console.error(err);
  }
}

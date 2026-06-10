/**
 * Debug: show exactly what 35 fields are sent after the smart filter
 */
require('dotenv').config();
const mongoose = require('mongoose');
const MONGO_URI = 'mongodb+srv://jeetdodia12_db_user:JD86048604%40%40@jagtap.p3fbvac.mongodb.net/petro-valve?appName=petro-valve';

mongoose.connect(MONGO_URI).then(async () => {
  const FieldDefinition = require('./src/models/FieldDefinition');
  const fields = await FieldDefinition.find({ formContext: 'Enquiry', isActive: true, isDeleted: false });

  const emailText = `Please find attached datasheet for quotation.

--- Attachment: Valve_Datasheet_4inch.pdf ---
PETRO VALVE INDUSTRIES
Technical Datasheet — Carbon Steel Ball Valve
PARAMETER SPECIFICATION
Product CS Ball Valve
Size 100 MM (4")
Pressure Class 300#
Body Material ASTM A216 WCB
Seat Material PTFE
Ball Material ASTM A216 WCB (Chrome Plated)
End Connection BW (Butt Weld)
Operation Manual (Lever Operated)
Quantity 5 NOS`;

  const productDescription = 'CS Ball Valve 300# 100MM';
  const MAX_FIELDS = 35;
  const textLower = (emailText + ' ' + productDescription).toLowerCase();

  const scoreField = (f) => {
    let score = 0;
    if (f.isRequired) score += 100;
    const labelWords = f.fieldLabel.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    for (const word of labelWords) { if (textLower.includes(word)) score += 10; }
    const nameWords = f.fieldName.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    for (const word of nameWords) { if (textLower.includes(word)) score += 5; }
    return score;
  };

  const scored = fields.map(f => ({ field: f, score: scoreField(f) })).sort((a, b) => b.score - a.score);
  const required = scored.filter(s => s.field.isRequired).map(s => s.field);
  const optional = scored.filter(s => !s.field.isRequired).slice(0, MAX_FIELDS - required.length).map(s => s.field);
  const relevantFields = [...required, ...optional];

  console.log('Required fields selected (' + required.length + '):');
  required.forEach(f => console.log('  REQ:', f.fieldName, '-', f.fieldLabel));

  console.log('\nTop optional fields selected (' + optional.length + '):');
  optional.forEach(f => {
    const s = scored.find(x => x.field.fieldName === f.fieldName);
    console.log('  score=' + s.score + ':', f.fieldName, '-', f.fieldLabel);
  });

  // Build prompt to check
  const fieldListStr = relevantFields.map(f => {
    return `- "${f.fieldName}" (type: ${f.fieldType}, label: "${f.fieldLabel}"): ${f.options && f.options.length ? '(Options: ' + JSON.stringify(f.options) + ')' : ''}`;
  }).join('\n');

  console.log('\nFinal prompt field list:\n', fieldListStr.substring(0, 2000));

  // Try the actual API call with these filtered fields
  const apiKey = process.env.GROQ_API_KEY;
  const prompt = `You are a data extraction bot.
Read the email text below:
"""
${emailText}
"""
CRITICAL FOCUS:
We are extracting specifications specifically for this product item: "${productDescription}".

We have defined the following custom fields that we need to extract from this text:
${fieldListStr}

Extract values for these fields. Return ONLY a JSON object containing the fieldName keys that you found values for.
Return ONLY the raw JSON string. Do not wrap in markdown quotes or add explanations.`;

  console.log('\nPrompt total length:', prompt.length, 'chars');
  
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    })
  });

  const body = await res.json();
  console.log('\nGroq status:', res.status);
  if (res.ok) {
    const raw = body.choices[0].message.content;
    console.log('Response:', raw);
  } else {
    console.log('Error:', JSON.stringify(body));
  }

  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });

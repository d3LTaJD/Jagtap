/**
 * Test AI dynamic field extraction directly to diagnose why {} is returned
 */
const path = require('path');

(async () => {
  const fileParsingService = require('./src/services/fileParsingService');
  const { getFileBuffer } = require('./src/services/localStorageService');

  // Build the context we know works
  const emailBody = 'Please find attached datasheet for quotation.';
  const pdfText = `PETRO VALVE INDUSTRIES
Technical Datasheet — Carbon Steel Ball Valve
PARAMETER SPECIFICATION
Product CS Ball Valve
Size 100 MM (4")
Pressure Class 300#
Body Material ASTM A216 WCB
Seat Material PTFE
Ball Material ASTM A216 WCB (Chrome Plated)
Stem Material ASTM A182 F6a
End Connection BW (Butt Weld)
Operation Manual (Lever Operated)
Temperature Range -29°C to +200°C
Pressure Rating 51.1 Bar @ 38°C
Testing Standard API 6D / API 598
Face to Face As per ASME B16.10
Quantity 5 NOS`;

  const fullContext = emailBody + '\n\n--- Attachment: Valve_Datasheet_4inch.pdf ---\n' + pdfText;

  // Simulate field definitions (minimal set — only the valve-relevant ones)
  const mockFields = [
    { fieldName: 'valve_type',  fieldLabel: 'Valve Type',       fieldType: 'Dropdown', options: ['Ball Valve', 'Gate Valve', 'Globe Valve', 'Check Valve', 'Butterfly Valve', 'Plug Valve'] },
    { fieldName: 'valve_size',  fieldLabel: 'Valve Size (DN)',   fieldType: 'Text',     options: [] },
    { fieldName: 'valve_class', fieldLabel: 'Pressure Class',   fieldType: 'Dropdown', options: ['150#', '300#', '600#', '900#', '1500#', '2500#'] },
    { fieldName: 'valve_moc_body',  fieldLabel: 'Body Material (MOC)', fieldType: 'Text', options: [] },
    { fieldName: 'valve_end_connection', fieldLabel: 'End Connection', fieldType: 'Dropdown', options: ['BW', 'RF', 'FF', 'RTJ', 'SW', 'THD'] },
    { fieldName: 'valve_operating', fieldLabel: 'Operation Type', fieldType: 'Dropdown', options: ['Manual', 'Gear Operated', 'Actuated - Electric', 'Actuated - Pneumatic'] }
  ];

  require('dotenv').config();
  console.log('GROQ_API_KEY present:', !!process.env.GROQ_API_KEY);
  console.log('GEMINI_API_KEY present:', !!process.env.GEMINI_API_KEY);
  console.log('Context length:', fullContext.length);
  console.log('Fields:', mockFields.map(f => f.fieldName).join(', '));
  console.log('');

  // Build the same prompt the AI service uses
  const fieldListStr = mockFields.map(f => {
    return `- "${f.fieldName}" (type: ${f.fieldType}, label: "${f.fieldLabel}"): ${f.placeholder || ''} ${f.options && f.options.length ? '(Options: ' + JSON.stringify(f.options) + ')' : ''}`;
  }).join('\n');

  const prompt = `You are a data extraction bot.
Read the email text below:
"""
${fullContext}
"""

CRITICAL FOCUS:
We are extracting specifications specifically for this product item: "CS Ball Valve 300# 100MM".

We have defined the following custom fields that we need to extract from this text:
${fieldListStr}

Extract values for these fields. Return ONLY a JSON object containing the fieldName keys that you found values for.
Return ONLY the raw JSON string. Do not wrap in markdown quotes or add explanations.`;

  console.log('PROMPT (first 500 chars):\n', prompt.substring(0, 500));
  console.log('...\n');

  // Try Groq
  if (process.env.GROQ_API_KEY) {
    try {
      const url = 'https://api.groq.com/openai/v1/chat/completions';
      const payload = {
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify(payload)
      });
      const body = await res.json();
      console.log('Groq status:', res.status);
      if (res.ok) {
        const raw = body.choices?.[0]?.message?.content;
        console.log('Groq raw response:', raw);
        try { console.log('Parsed:', JSON.parse(raw)); } catch(e) { console.log('Parse error:', e.message); }
      } else {
        console.log('Groq error:', JSON.stringify(body));
      }
    } catch(e) {
      console.error('Groq call failed:', e.message);
    }
  } else {
    console.log('No GROQ key - skipping Groq test');
  }
})();

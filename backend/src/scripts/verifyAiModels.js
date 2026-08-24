/**
 * TEST API MODELS CONFIGURATION AND VALIDITY
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function verifyModels() {
  console.log('--- TESTING GEMINI MODELS ---');
  const geminiModels = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-3.6-flash', // test invalid
    'gemini-3.5-flash-lite' // test invalid
  ];

  for (const m of geminiModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond strictly in JSON: {"status": "ok"}' }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });
      console.log(`Gemini [${m}]: Status ${res.status} ${res.statusText}`);
    } catch (err) {
      console.log(`Gemini [${m}]: Error ${err.message}`);
    }
  }

  console.log('\n--- TESTING OPENAI ---');
  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Respond with JSON: {"status": "ok"}' }],
          response_format: { type: 'json_object' }
        })
      });
      console.log(`OpenAI [gpt-4o-mini]: Status ${res.status} ${res.statusText}`);
    } catch (err) {
      console.log(`OpenAI [gpt-4o-mini]: Error ${err.message}`);
    }
  } else {
    console.log('OpenAI: No OPENAI_API_KEY configured');
  }

  console.log('\n--- TESTING GROQ ---');
  if (process.env.GROQ_API_KEY) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: 'Respond with JSON: {"status": "ok"}' }],
          response_format: { type: 'json_object' }
        })
      });
      console.log(`Groq [llama-3.3-70b-versatile]: Status ${res.status} ${res.statusText}`);
    } catch (err) {
      console.log(`Groq [llama-3.3-70b-versatile]: Error ${err.message}`);
    }
  } else {
    console.log('Groq: No GROQ_API_KEY configured');
  }
}

verifyModels().catch(console.error);

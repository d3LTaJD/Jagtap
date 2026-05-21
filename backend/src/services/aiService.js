const { logActivity } = require('../utils/logger');

/**
 * AI Service for parsing email texts into structured lead objects.
 * Supports Gemini 1.5 Flash (default), OpenAI GPT-4o-mini, and a regex heuristic fallback.
 */

// Normalizes AI product category outputs to the Mongoose Enquiry enum
const PRODUCT_CATEGORIES = [
  'Pressure Vessel',
  'Heat Exchanger',
  'Storage Tank',
  'Piping',
  'Structural',
  'Custom',
  'Multiple'
];

// Normalizes AI standard code outputs to the Mongoose Enquiry enum
const STANDARD_CODES = [
  'ASME',
  'IS',
  'BS',
  'EN',
  'API',
  'IBR',
  'Custom',
  'Not specified'
];

/**
 * Extracts structured enquiry data from email raw text.
 * 
 * @param {string} emailText The email body content
 * @param {object} metadata Information about the email sender (from, subject)
 * @returns {Promise<object>} Parsed structured lead details
 */
exports.extractEnquiryDetails = async (emailText, metadata = {}) => {
  const fromAddress = metadata.from || '';
  const subjectText = metadata.subject || '';
  
  console.log(`[AI Extraction] Processing email from "${fromAddress}" with subject "${subjectText}"`);

  // Attempt using Gemini first
  if (process.env.GEMINI_API_KEY) {
    try {
      return await callGemini(emailText, fromAddress, subjectText);
    } catch (err) {
      console.error('[AI Extraction] Gemini API call failed, trying fallback...', err.message);
    }
  }

  // Attempt using OpenAI next
  if (process.env.OPENAI_API_KEY) {
    try {
      return await callOpenAI(emailText, fromAddress, subjectText);
    } catch (err) {
      console.error('[AI Extraction] OpenAI API call failed, trying fallback...', err.message);
    }
  }

  // Final fallback: Local Heuristics (no API keys, offline testing, or API failure)
  console.log('[AI Extraction] Using heuristic regex-based fallback extractor.');
  return runHeuristicExtraction(emailText, fromAddress, subjectText);
};

/**
 * Call Gemini 1.5 Flash API with JSON response constraints.
 */
async function callGemini(text, from, subject) {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const prompt = buildPrompt(text, from, subject);
  
  const payload = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini API returned status ${res.status}: ${errorText}`);
  }

  const result = await res.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error("Gemini response is empty or formatted incorrectly");

  return cleanAndNormalizeResult(JSON.parse(rawText.trim()), from);
}

/**
 * Call OpenAI Chat Completion API with JSON response format.
 */
async function callOpenAI(text, from, subject) {
  const apiKey = process.env.OPENAI_API_KEY;
  const url = 'https://api.openai.com/v1/chat/completions';
  
  const prompt = buildPrompt(text, from, subject);

  const payload = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI API returned status ${res.status}: ${errorText}`);
  }

  const result = await res.json();
  const rawText = result.choices?.[0]?.message?.content;
  if (!rawText) throw new Error("OpenAI response is empty or formatted incorrectly");

  return cleanAndNormalizeResult(JSON.parse(rawText.trim()), from);
}

/**
 * Builds the prompting guidelines for the model.
 */
function buildPrompt(emailText, from, subject) {
  return `You are a data entry automation bot for Petro Valve Workflow Automation.
Your task is to parse a customer's email request and extract structured enquiry details to fit our backend database.

Read the email details below:
Sender Info (From): ${from}
Subject: ${subject}
Email Body:
"""
${emailText}
"""

Extract and return ONLY a JSON object containing the following keys (do not wrap in markdown quotes, return ONLY the raw JSON string):

1. "companyName" (string): The company the sender represents. If not mentioned in the text, guess it from the email signature or domain name of the email address (e.g. for "sales@abccorp.com", return "ABC Corp"). If it's a generic public email (e.g. Gmail/Yahoo) and no company is mentioned, write "Individual Customer".
2. "primaryContactName" (string): The sender's name. Check the signature or headers (e.g., if From is "John Doe <john@abc.com>", it's "John Doe"). Default to "Email Contact" if unknown.
3. "mobileNumber" (string): The contact's phone/mobile number. Check the email signature block or text. If not found, output "0000000000".
4. "productCategory" (string): Must match exactly one of the following:
   - "Piping" (Use this for all valves, ball valves, gate valves, check valves, flanges, piping parts, etc.)
   - "Pressure Vessel"
   - "Heat Exchanger"
   - "Storage Tank"
   - "Structural"
   - "Custom"
   - "Multiple"
   Default to "Piping" for valve inquiries.
5. "productDescription" (string): A short, professional summary of the items and specs requested (e.g., "50 pcs Ball Valves, 2 inch, Class 150"). Limit to 200 characters.
6. "quantity" (number): The total quantity of items requested (integer). Default to 1 if not specified.
7. "unit" (string): The unit of quantity. Must be one of: "NOS", "SET", "MT", "KG", "M", "M2", "Job". Default is "NOS".
8. "standardCode" (string): The technical standard requested. Must be one of: "ASME", "IS", "BS", "EN", "API", "IBR", "Custom", "Not specified". Default to "Not specified" if unknown.
9. "specialRequirements" (string): Any specific material details, inspections, delivery requests, or paint specs. Limit to 400 characters. Leave empty if none.
10. "priority" (string): The urgency of the request. Must be one of: "Urgent", "High", "Medium", "Low". Base this on words like "urgent", "immediate", "ASAP" or deadlines. Default is "Medium".
11. "isEnquiry" (boolean): True if this email is a genuine commercial inquiry, request for quotation (RFQ), or product specification request for Petro Valve's products (valves, pipes, flanges, vessels, etc.). False if it is a general discussion, promotional material, spam, newsletter, newsletter subscription, delivery failure bounce, personal email, or unrelated content.

You MUST return a valid JSON object matching these instructions. Do not add explanations.`;
}

/**
 * Normalizes values to make sure they match database schemas perfectly.
 */
function cleanAndNormalizeResult(data, defaultFromEmail) {
  // 1. Clean product category
  let category = data.productCategory;
  if (!PRODUCT_CATEGORIES.includes(category)) {
    // If it's a valve, default to Piping
    if (category?.toLowerCase().includes('valve')) {
      category = 'Piping';
    } else {
      category = 'Custom';
    }
  }

  // 2. Clean standard code
  let std = data.standardCode;
  if (!STANDARD_CODES.includes(std)) {
    std = 'Not specified';
  }

  // 3. Clean Priority
  let prio = data.priority;
  if (!['Urgent', 'High', 'Medium', 'Low'].includes(prio)) {
    prio = 'Medium';
  }

  // 4. Ensure mobile number exists and is a string
  let mobile = String(data.mobileNumber || '').trim().replace(/[^0-9+]/g, '');
  if (!mobile || mobile.length < 5) {
    mobile = '0000000000';
  }

  // 5. Ensure quantities are numeric
  let qty = parseInt(data.quantity, 10);
  if (isNaN(qty) || qty <= 0) qty = 1;

  // 6. Clean email
  const extractedEmail = String(data.emailAddress || '').trim();
  const matchedEmail = extractedEmail.includes('@') ? extractedEmail : extractEmailFromString(defaultFromEmail);

  return {
    companyName: String(data.companyName || '').trim() || 'Individual Customer',
    primaryContactName: String(data.primaryContactName || '').trim() || 'Email Sender',
    mobileNumber: mobile,
    emailAddress: matchedEmail,
    productCategory: category,
    productDescription: String(data.productDescription || '').trim().substring(0, 200) || 'Valve Enquiry via Email',
    quantity: qty,
    unit: ['NOS', 'SET', 'MT', 'KG', 'M', 'M2', 'Job'].includes(data.unit) ? data.unit : 'NOS',
    standardCode: std,
    specialRequirements: String(data.specialRequirements || '').trim().substring(0, 400),
    priority: prio,
    isEnquiry: data.isEnquiry === undefined ? true : Boolean(data.isEnquiry)
  };
}

/**
 * Local Regex fallback extractor for offline test runs or API errors.
 */
function runHeuristicExtraction(text, from, subject) {
  const cleanFrom = extractEmailFromString(from);
  const fromName = from.split('<')[0].trim().replace(/"/g, '') || 'Email Sender';
  
  // Try to extract company name from domain
  let domain = cleanFrom.split('@')[1] || '';
  let company = 'Individual Customer';
  if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'rediffmail.com', 'outlook.com'].includes(domain.toLowerCase())) {
    const parts = domain.split('.');
    company = parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + ' Ltd';
  }

  // Try to find quantity (numbers before words like pcs, pieces, nos, qty)
  let qty = 1;
  const qtyMatch = text.match(/(\d+)\s*(?:pcs|pieces|nos|qty|items)/i);
  if (qtyMatch) {
    qty = parseInt(qtyMatch[1], 10);
  }

  // Guess priority
  let priority = 'Medium';
  if (/urgent|asap|immediate|critical|fast/i.test(text) || /urgent|asap/i.test(subject)) {
    priority = 'Urgent';
  }

  // Standard code check
  let standard = 'Not specified';
  if (/asme/i.test(text)) standard = 'ASME';
  else if (/api/i.test(text)) standard = 'API';
  else if (/ibr/i.test(text)) standard = 'IBR';
  else if (/is\s*\d+/i.test(text)) standard = 'IS';

  // Build a short description
  let desc = subject.substring(0, 100);
  if (text.length > 0) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5 && !l.includes(':'));
    if (lines.length > 0) {
      desc = lines[0].substring(0, 150);
    }
  }

  return {
    companyName: company,
    primaryContactName: fromName,
    mobileNumber: '0000000000',
    emailAddress: cleanFrom,
    productCategory: 'Piping', // Default to valve category
    productDescription: desc || 'Enquiry via email',
    quantity: qty,
    unit: 'NOS',
    standardCode: standard,
    specialRequirements: `Raw Subject: ${subject}`,
    priority: priority,
    isEnquiry: true
  };
}

function extractEmailFromString(str) {
  const match = str.match(/<([^>]+)>/) || str.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
  return match ? match[1].trim() : str.trim();
}

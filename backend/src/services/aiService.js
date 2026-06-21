const { logActivity } = require('../utils/logger');

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
 * Extracts a list of enquiries and customer details from email body and attachments.
 * One email may contain one or more product items. The system will create one Enquiry per extracted product item.
 * 
 * @param {string} emailText The email body content
 * @param {Array} attachments List of attachments with originalFileName and extractedText
 * @param {object} metadata Information about the email sender (from, subject)
 * @returns {Promise<object>} Parsed structured details containing enquiries array
 */
exports.extractEnquiries = async (emailText, attachments = [], metadata = {}) => {
  const fromAddress = metadata.from || '';
  const subjectText = metadata.subject || '';
  
  console.log(`[AI Multi-Extraction] Processing email from "${fromAddress}" with subject "${subjectText}"`);

  // Format attachments list for prompt context
  const attachmentsListStr = (attachments || []).map((att, index) => {
    return `Attachment #${index + 1}:
Filename: ${att.originalFileName}
Category: ${att.attachmentCategory || 'Unknown'}
Extracted Text Content:
"""
${att.extractedText || '(No text content extracted)'}
"""`;
  }).join('\n\n');

  const prompt = `You are an enterprise email routing and requirements gathering bot for Petro Valve Workflow Automation.
Read the customer email request and its parsed attachments:

Sender Info (From): ${fromAddress}
Subject: ${subjectText}
Email Body:
"""
${emailText}
"""

Parsed Email Attachments:
${attachmentsListStr || 'None'}

Your task is to parse this email request and its attachments, extract customer contact details, and split the request into one or more product enquiries. One email may contain one or more product items. The system will create one Enquiry per extracted product item.

Return ONLY a JSON object containing the following keys (do not wrap in markdown quotes, return ONLY the raw JSON string):

1. "isEnquiry" (boolean): True if this email is a genuine commercial inquiry, request for quotation (RFQ), or product specification request for Petro Valve's products (valves, pipes, flanges, vessels, etc.). False if it is a general discussion, promotional material, spam, newsletter, bounce, or unrelated content.
2. "companyName" (string): The company the sender represents. Guess it from the signature, email domain, or attachments. Write "Individual Customer" if unknown.
3. "primaryContactName" (string): The sender's name. Default to "Email Contact" if unknown.
4. "mobileNumber" (string): The contact's phone/mobile number. Check the signature block. Default to "0000000000" if unknown.
5. "enquiries" (array of objects): An array of product items extracted. Each item must contain:
   - "productCategory" (string): Must match exactly one of: "Piping", "Pressure Vessel", "Heat Exchanger", "Storage Tank", "Structural", "Custom", "Multiple". (Default is "Piping" for valve inquiries).
   - "productDescription" (string): A short, professional summary of the items and specs requested (e.g., "CS BALL VALVE BWE 300#, 100MM (4\")"). Limit to 200 characters.
   - "quantity" (number): The quantity of items requested. Default is 1.
   - "unit" (string): Must be one of: "NOS", "SET", "MT", "KG", "M", "M2", "Job". Default is "NOS".
   - "standardCode" (string): Must be one of: "ASME", "IS", "BS", "EN", "API", "IBR", "Custom", "Not specified". Default is "Not specified".
   - "specialRequirements" (string): Any specific material details, paint specs, or special inspections. Limit to 400 characters.
   - "priority" (string): Must be one of: "Urgent", "High", "Medium", "Low". Default is "Medium".
   - "confidence" (number): A score from 0 to 100 representing your certainty of this extraction.
   - "linkedAttachmentNames" (array of strings): The exact filenames of the attachments that contain details or drawings for this specific product item. (Must match the filenames provided in the attachment list above).

You MUST return a valid JSON object matching these instructions. Do not add explanations.`;

  // 1. Try Groq
  if (process.env.GROQ_API_KEY) {
    try {
      const apiKey = process.env.GROQ_API_KEY;
      const url = 'https://api.groq.com/openai/v1/chat/completions';
      const payload = {
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
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
      if (res.ok) {
        const result = await res.json();
        const rawText = result.choices?.[0]?.message?.content;
        if (rawText) {
          return cleanAndNormalizeMultiResult(JSON.parse(rawText.trim()), fromAddress);
        }
      }
    } catch (err) {
      console.error('[AI Multi-Extraction] Groq API call failed, trying fallback...', err.message);
    }
  }

  // 2. Try Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const result = await res.json();
        const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          return cleanAndNormalizeMultiResult(JSON.parse(rawText.trim()), fromAddress);
        }
      }
    } catch (err) {
      console.error('[AI Multi-Extraction] Gemini API call failed, trying fallback...', err.message);
    }
  }

  // 3. Try OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      const url = 'https://api.openai.com/v1/chat/completions';
      const payload = {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
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
      if (res.ok) {
        const result = await res.json();
        const rawText = result.choices?.[0]?.message?.content;
        if (rawText) {
          return cleanAndNormalizeMultiResult(JSON.parse(rawText.trim()), fromAddress);
        }
      }
    } catch (err) {
      console.error('[AI Multi-Extraction] OpenAI API call failed, trying fallback...', err.message);
    }
  }

  // Final fallback: Local Heuristics
  console.log('[AI Multi-Extraction] Using heuristic fallback.');
  const singleEnquiry = runHeuristicExtraction(emailText, fromAddress, subjectText);
  return {
    isEnquiry: singleEnquiry.isEnquiry,
    companyName: singleEnquiry.companyName,
    primaryContactName: singleEnquiry.primaryContactName,
    mobileNumber: singleEnquiry.mobileNumber,
    enquiries: [
      {
        productCategory: singleEnquiry.productCategory,
        productDescription: singleEnquiry.productDescription,
        quantity: singleEnquiry.quantity,
        unit: singleEnquiry.unit,
        standardCode: singleEnquiry.standardCode,
        specialRequirements: singleEnquiry.specialRequirements,
        priority: singleEnquiry.priority,
        confidence: 100,
        linkedAttachmentNames: []
      }
    ]
  };
};

/**
 * Normalizes values of multi-enquiry AI output to match schemas perfectly.
 */
function cleanAndNormalizeMultiResult(data, defaultFromEmail) {
  if (data.isEnquiry === false || !data.enquiries || !Array.isArray(data.enquiries)) {
    return {
      isEnquiry: false,
      companyName: 'Individual Customer',
      primaryContactName: 'Email Sender',
      mobileNumber: '0000000000',
      enquiries: []
    };
  }

  // Clean contact details
  let mobile = String(data.mobileNumber || '').trim().replace(/[^0-9+]/g, '');
  if (!mobile || mobile.length < 5) {
    mobile = '0000000000';
  }

  const cleanedEnquiries = data.enquiries.map(item => {
    let category = item.productCategory;
    if (!PRODUCT_CATEGORIES.includes(category)) {
      category = category?.toLowerCase().includes('valve') ? 'Piping' : 'Custom';
    }

    let std = item.standardCode;
    if (!STANDARD_CODES.includes(std)) {
      std = 'Not specified';
    }

    let prio = item.priority;
    if (!['Urgent', 'High', 'Medium', 'Low'].includes(prio)) {
      prio = 'Medium';
    }

    let qty = parseInt(item.quantity, 10);
    if (isNaN(qty) || qty <= 0) qty = 1;

    let conf = parseInt(item.confidence, 10);
    if (isNaN(conf) || conf < 0 || conf > 100) conf = 100;

    return {
      productCategory: category,
      productDescription: String(item.productDescription || '').trim().substring(0, 200) || 'Valve Enquiry via Email',
      quantity: qty,
      unit: ['NOS', 'SET', 'MT', 'KG', 'M', 'M2', 'Job'].includes(item.unit) ? item.unit : 'NOS',
      standardCode: std,
      specialRequirements: String(item.specialRequirements || '').trim().substring(0, 400),
      priority: prio,
      confidence: conf,
      linkedAttachmentNames: Array.isArray(item.linkedAttachmentNames) ? item.linkedAttachmentNames.map(f => String(f).trim()) : []
    };
  });

  return {
    isEnquiry: true,
    companyName: String(data.companyName || '').trim() || 'Individual Customer',
    primaryContactName: String(data.primaryContactName || '').trim() || 'Email Sender',
    mobileNumber: mobile,
    emailAddress: extractEmailFromString(defaultFromEmail),
    enquiries: cleanedEnquiries
  };
}

/**
 * Dynamic Field Extractor from emails focusing on a target product description.
 */
exports.extractDynamicFields = async (emailText, fieldDefinitions, productDescription = '') => {
  if (!fieldDefinitions || fieldDefinitions.length === 0) return {};

  // ── Smart Field Pre-Filtering ──────────────────────────────────────────────
  // When there are many fields (cross-category), the LLM can return {} or poor
  // results because the prompt is too long. Score fields by relevance to the
  // text and keep the top MAX_FIELDS most relevant ones (always including
  // required fields so they are never silently dropped).
  const MAX_FIELDS = 100;
  let relevantFields = fieldDefinitions;

  if (fieldDefinitions.length > MAX_FIELDS) {
    const textLower = (emailText + ' ' + productDescription).toLowerCase();

    const scoreField = (f) => {
      let score = 0;
      // Required fields always get a bonus
      if (f.isRequired) score += 100;
      // Score by how many words from the label appear in the text
      const labelWords = f.fieldLabel.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2);
      for (const word of labelWords) {
        if (textLower.includes(word)) score += 10;
      }
      // Score by fieldName keyword match (e.g. valve_ prefix when text has 'valve')
      const nameWords = f.fieldName.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 2);
      for (const word of nameWords) {
        if (textLower.includes(word)) score += 5;
      }
      return score;
    };

    const scored = fieldDefinitions
      .map(f => ({ field: f, score: scoreField(f) }))
      .sort((a, b) => b.score - a.score);

    // Always include required fields + top scoring optional fields up to MAX_FIELDS
    const required = scored.filter(s => s.field.isRequired).map(s => s.field);
    const optional = scored.filter(s => !s.field.isRequired).slice(0, MAX_FIELDS - required.length).map(s => s.field);
    relevantFields = [...required, ...optional];

    console.log(`[AI Dynamic Extraction] Filtered ${fieldDefinitions.length} fields → ${relevantFields.length} relevant fields for: "${productDescription}"`);
  }

  const fieldListStr = relevantFields.map(f => {
    return `- "${f.fieldName}" (type: ${f.fieldType}, label: "${f.fieldLabel}"): ${f.placeholder || ''} ${f.options && f.options.length ? '(Options: ' + JSON.stringify(f.options) + ')' : ''}`;
  }).join('\n');

  let itemContextFocus = '';
  if (productDescription) {
    itemContextFocus = `
CRITICAL FOCUS:
We are extracting specifications specifically for this product item: "${productDescription}".
Ignore specifications that belong to other product items mentioned in the text. Focus ONLY on this specific item.
`;
  }

  const prompt = `You are a data extraction bot.
Read the email text below:
"""
${emailText}
"""
${itemContextFocus}

We have defined the following custom fields that we need to extract from this text:
${fieldListStr}

Extract values for these fields. Return ONLY a JSON object containing the fieldName keys that you found values for. For fields that are not mentioned or cannot be determined, do NOT include them in the JSON object.
Ensure values match the expected types:
- Dropdown fields must match one of the listed options (case-insensitive or exact).
- Checkbox fields must be boolean (true/false).
- Number fields must be numeric.
- Text fields must be strings.

Return ONLY the raw JSON string. Do not wrap in markdown quotes or add explanations.`;

  // 1. Try Groq
  if (process.env.GROQ_API_KEY) {
    try {
      const apiKey = process.env.GROQ_API_KEY;
      const url = 'https://api.groq.com/openai/v1/chat/completions';
      const payload = {
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
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
      if (res.ok) {
        const result = await res.json();
        const rawText = result.choices?.[0]?.message?.content;
        if (rawText) {
          const parsed = JSON.parse(rawText.trim());
          console.log(`[AI Dynamic Extraction] Groq extracted ${Object.keys(parsed).length} field(s):`, JSON.stringify(parsed));
          return normalizeExtractedFields(parsed, fieldDefinitions);
        }
      } else {
        const errBody = await res.json().catch(() => ({}));
        console.error(`[AI Dynamic Extraction] Groq API error ${res.status}:`, JSON.stringify(errBody).substring(0, 200));
      }
    } catch (err) {
      console.error('[AI Dynamic Extraction] Groq API failed:', err.message);
    }
  }

  // 2. Try Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const result = await res.json();
        const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          return normalizeExtractedFields(JSON.parse(rawText.trim()), fieldDefinitions);
        }
      }
    } catch (err) {
      console.error('[AI Dynamic Extraction] Gemini API failed:', err.message);
    }
  }

  // 3. Try OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      const url = 'https://api.openai.com/v1/chat/completions';
      const payload = {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
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
      if (res.ok) {
        const result = await res.json();
        const rawText = result.choices?.[0]?.message?.content;
        if (rawText) {
          return normalizeExtractedFields(JSON.parse(rawText.trim()), fieldDefinitions);
        }
      }
    } catch (err) {
      console.error('[AI Dynamic Extraction] OpenAI API failed:', err.message);
    }
  }

  // Heuristic fallback
  const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const extracted = {};
  for (const field of fieldDefinitions) {
    const label = field.fieldLabel;
    const labelClean = label.replace(/\([^)]*\)/g, '').trim();
    const name = field.fieldName;
    
    const escapedLabel = escapeRegExp(label);
    const escapedLabelClean = escapeRegExp(labelClean);
    const escapedName = escapeRegExp(name);

    const patterns = [
      new RegExp(`${escapedLabel}\\s*[:=-]\\s*([^\\n]+)`, 'i'),
      new RegExp(`${escapedLabelClean}\\s*[:=-]\\s*([^\\n]+)`, 'i'),
      new RegExp(`${escapedName}\\s*[:=-]\\s*([^\\n]+)`, 'i')
    ];
    
    for (const regex of patterns) {
      const match = emailText.match(regex);
      if (match) {
        let val = match[1].trim();
        val = val.replace(/[,;]$/, '');
        if (field.fieldType.includes('Number')) {
          const num = parseFloat(val);
          if (!isNaN(num)) extracted[field.fieldName] = num;
        } else if (field.fieldType.includes('Checkbox')) {
          extracted[field.fieldName] = /yes|true|1/i.test(val);
        } else {
          if (field.options && field.options.length) {
            let matchedOpt = field.options.find(opt => String(opt).toLowerCase() === val.toLowerCase());
            if (!matchedOpt) {
              const normalize = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
              const normVal = normalize(val);
              matchedOpt = field.options.find(opt => normalize(opt) === normVal);
            }
            if (matchedOpt) {
              extracted[field.fieldName] = matchedOpt;
            } else {
              extracted[field.fieldName] = val;
            }
          } else {
            extracted[field.fieldName] = val;
          }
        }
        break;
      }
    }
  }
  return extracted;
};

/**
 * Normalizes options and drops irrelevant keys.
 */
function normalizeExtractedFields(data, fieldDefinitions) {
  const normalized = {};
  for (const key of Object.keys(data)) {
    const field = fieldDefinitions.find(f => f.fieldName === key);
    if (field) {
      let val = data[key];
      if (field.fieldType.includes('Dropdown') && field.options && field.options.length) {
        const matchedOpt = field.options.find(opt => {
          const normalizeStr = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
          return normalizeStr(opt) === normalizeStr(val);
        });
        if (matchedOpt) {
          normalized[key] = matchedOpt;
          continue;
        }
      }
      normalized[key] = val;
    }
  }
  return normalized;
}

/**
 * Local Regex fallback extractor for offline test runs or API errors.
 */
function runHeuristicExtraction(text, from, subject) {
  const cleanFrom = extractEmailFromString(from);
  const fromName = from.split('<')[0].trim().replace(/"/g, '') || 'Email Sender';
  
  let domain = cleanFrom.split('@')[1] || '';
  let company = 'Individual Customer';
  if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'rediffmail.com', 'outlook.com'].includes(domain.toLowerCase())) {
    const parts = domain.split('.');
    company = parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + ' Ltd';
  }

  let qty = 1;
  const qtyMatch = text.match(/(\d+)\s*(?:pcs|pieces|nos|qty|items)/i);
  if (qtyMatch) {
    qty = parseInt(qtyMatch[1], 10);
  }

  let priority = 'Medium';
  if (/urgent|asap|immediate|critical|fast/i.test(text) || /urgent|asap/i.test(subject)) {
    priority = 'Urgent';
  }

  let standard = 'Not specified';
  if (/asme/i.test(text)) standard = 'ASME';
  else if (/api/i.test(text)) standard = 'API';
  else if (/ibr/i.test(text)) standard = 'IBR';
  else if (/is\s*\d+/i.test(text)) standard = 'IS';

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
    productCategory: 'Piping',
    productDescription: desc || 'Enquiry via email',
    quantity: qty,
    unit: 'NOS',
    standardCode: standard,
    specialRequirements: `Raw Subject: ${subject}`,
    priority: priority,
    isEnquiry: true
  };
}

/**
 * Email Classification Categories
 */
const EMAIL_CATEGORIES = ['Enquiry', 'Tender', 'Follow-up', 'Vendor Document', 'Spam/Other'];

/**
 * Classifies an incoming email into one of: Enquiry, Tender, Follow-up, Vendor Document, Spam/Other.
 * Uses the same AI fallback chain (Groq → Gemini → OpenAI → Heuristic).
 *
 * @param {string} emailText The email body text
 * @param {object} metadata { from, subject }
 * @param {Array} attachmentNames List of attachment filenames
 * @returns {Promise<object>} { category, confidence, reason }
 */
exports.classifyEmail = async (emailText, metadata = {}, attachmentNames = []) => {
  const fromAddress = metadata.from || '';
  const subjectText = metadata.subject || '';

  console.log(`[AI Classification] Classifying email from "${fromAddress}" subject "${subjectText}"`);

  const attachmentsList = attachmentNames.length > 0
    ? `Attachment Filenames: ${attachmentNames.join(', ')}`
    : 'No attachments';

  const prompt = `You are an email classification bot for Petro Valve, an industrial valve and piping manufacturer.

Classify this incoming email into EXACTLY ONE of these categories:

1. "Enquiry" — A new commercial request, Request for Quotation (RFQ), product inquiry, or price request from a customer/buyer wanting to purchase valves, pipes, flanges, vessels, or related industrial products. The sender wants pricing or is asking about products.

2. "Tender" — A formal government tender notice, bid invitation, tender document, NIT (Notice Inviting Tender), Expression of Interest (EOI), or GEM portal request. These often contain tender numbers, bid deadlines, EMD amounts, or formal procurement language. They may be from government bodies, PSUs, municipal corporations, or public sector entities.

3. "Follow-up" — A reply to an existing conversation, a status check, a delivery update request, revision to an existing enquiry, or any email that references a previous interaction or enquiry ID (ENQ-XXXX). Also includes emails requesting modifications to previously submitted requirements.

4. "Vendor Document" — An email from a supplier/vendor/sub-contractor sending material test certificates (MTC), inspection reports, delivery challans, invoices, purchase confirmations, material availability updates, or compliance documents. The sender is selling TO Petro Valve, not buying FROM them.

5. "Spam/Other" — Newsletters, promotional emails, auto-responses, out-of-office replies, job applications, HR-related emails, or any email that does not fit the above categories.

Email Details:
From: ${fromAddress}
Subject: ${subjectText}
${attachmentsList}

Email Body:
"""
${emailText.substring(0, 3000)}
"""

Return ONLY a JSON object with these keys:
- "category" (string): One of "Enquiry", "Tender", "Follow-up", "Vendor Document", "Spam/Other"
- "confidence" (number): 0-100 confidence score
- "reason" (string): One-line explanation of why this category was chosen (max 150 chars)
- "tenderNumber" (string or null): If category is "Tender", extract the tender/NIT number. Otherwise null.
- "tenderDeadline" (string or null): If category is "Tender", extract the bid submission deadline as ISO date string. Otherwise null.
- "referencedEnquiryIds" (array of strings): If category is "Follow-up", extract any ENQ-XXXX IDs mentioned. Otherwise empty array.

Return ONLY raw JSON. No explanations.`;

  const callAI = async (provider, url, buildPayload, parseResponse) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: buildPayload.headers,
        body: JSON.stringify(buildPayload.body)
      });
      if (res.ok) {
        const result = await res.json();
        const rawText = parseResponse(result);
        if (rawText) {
          const parsed = JSON.parse(rawText.trim());
          return normalizeClassification(parsed);
        }
      }
    } catch (err) {
      console.error(`[AI Classification] ${provider} failed:`, err.message);
    }
    return null;
  };

  // 1. Try Groq
  if (process.env.GROQ_API_KEY) {
    const result = await callAI('Groq', 'https://api.groq.com/openai/v1/chat/completions', {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: { model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } }
    }, r => r.choices?.[0]?.message?.content);
    if (result) return result;
  }

  // 2. Try Gemini
  if (process.env.GEMINI_API_KEY) {
    const result = await callAI('Gemini', `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      headers: { 'Content-Type': 'application/json' },
      body: { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }
    }, r => r.candidates?.[0]?.content?.parts?.[0]?.text);
    if (result) return result;
  }

  // 3. Try OpenAI
  if (process.env.OPENAI_API_KEY) {
    const result = await callAI('OpenAI', 'https://api.openai.com/v1/chat/completions', {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: { model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } }
    }, r => r.choices?.[0]?.message?.content);
    if (result) return result;
  }

  // 4. Heuristic fallback
  console.log('[AI Classification] Using heuristic fallback.');
  return heuristicClassify(emailText, subjectText, fromAddress, attachmentNames);
};

/**
 * Normalizes AI classification output.
 */
function normalizeClassification(data) {
  let category = data.category;
  if (!EMAIL_CATEGORIES.includes(category)) {
    // Fuzzy match
    const lower = (category || '').toLowerCase();
    if (lower.includes('tender') || lower.includes('nit') || lower.includes('bid')) category = 'Tender';
    else if (lower.includes('follow') || lower.includes('reply') || lower.includes('update')) category = 'Follow-up';
    else if (lower.includes('vendor') || lower.includes('supplier') || lower.includes('mtc')) category = 'Vendor Document';
    else if (lower.includes('spam') || lower.includes('other') || lower.includes('junk')) category = 'Spam/Other';
    else category = 'Enquiry'; // Default
  }

  let confidence = parseInt(data.confidence, 10);
  if (isNaN(confidence) || confidence < 0 || confidence > 100) confidence = 80;

  return {
    category,
    confidence,
    reason: String(data.reason || '').substring(0, 150),
    tenderNumber: category === 'Tender' ? (data.tenderNumber || null) : null,
    tenderDeadline: category === 'Tender' ? (data.tenderDeadline || null) : null,
    referencedEnquiryIds: Array.isArray(data.referencedEnquiryIds) ? data.referencedEnquiryIds : []
  };
}

/**
 * Keyword-based fallback classification when no AI API is available.
 */
function heuristicClassify(text, subject, from, attachmentNames) {
  const combined = `${subject} ${text} ${from}`.toLowerCase();
  const attStr = attachmentNames.join(' ').toLowerCase();

  // Tender keywords
  const tenderKeywords = ['tender', 'nit', 'notice inviting', 'bid invitation', 'eoi', 'expression of interest',
    'gem portal', 'earnest money', 'emd', 'bid submission', 'corrigendum', 'addendum',
    'procurement', 'rfp', 'request for proposal', 'municipal', 'public sector'];
  if (tenderKeywords.some(k => combined.includes(k))) {
    return { category: 'Tender', confidence: 75, reason: 'Tender keywords detected in subject/body', tenderNumber: null, tenderDeadline: null, referencedEnquiryIds: [] };
  }

  // Follow-up (reply)
  if (/^(re|fwd|fw)\s*:/i.test(subject.trim()) || /ENQ-\d{4}-\d{2}-\d{4}/i.test(combined)) {
    const refs = (combined.match(/ENQ-\d{4}-\d{2}-\d{4}/gi) || []).map(r => r.toUpperCase());
    return { category: 'Follow-up', confidence: 80, reason: 'Reply subject prefix or ENQ reference ID found', tenderNumber: null, tenderDeadline: null, referencedEnquiryIds: [...new Set(refs)] };
  }

  // Vendor document
  const vendorKeywords = ['mtc', 'material test certificate', 'inspection report', 'test report',
    'challan', 'delivery note', 'dispatch', 'invoice', 'proforma', 'quotation from',
    'material availability', 'stock available', 'rate list'];
  if (vendorKeywords.some(k => combined.includes(k) || attStr.includes(k))) {
    return { category: 'Vendor Document', confidence: 70, reason: 'Vendor/supplier document keywords detected', tenderNumber: null, tenderDeadline: null, referencedEnquiryIds: [] };
  }

  // Default to Enquiry
  return { category: 'Enquiry', confidence: 60, reason: 'Default classification — no specific category matched', tenderNumber: null, tenderDeadline: null, referencedEnquiryIds: [] };
}

exports.EMAIL_CATEGORIES = EMAIL_CATEGORIES;

function extractEmailFromString(str) {
  const match = str.match(/<([^>]+)>/) || str.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
  return match ? match[1].trim() : str.trim();
}

/**
 * Extracts commercial terms and compliance details from tender/enquiry PDF or email context
 * to pre-populate a Quotation.
 * 
 * @param {string} textContext Full parsed text of the email + attachments
 * @returns {Promise<object>} Extracted quotation terms
 */
exports.extractQuotationTerms = async (textContext) => {
  console.log(`[AI Term Extraction] Extracting commercial and compliance terms from context (${textContext.length} chars)`);

  const prompt = `You are a contract compliance and estimation bot for Petro Valve.
Read the tender document text and technical specifications below:
"""
${textContext.substring(0, 10000)}
"""

Extract the commercial terms, delivery period, and quality/inspection compliance requirements. 
Return ONLY a JSON object containing the following keys (do not wrap in markdown quotes, return ONLY raw JSON):

1. "paymentTerms" (string): Payment terms mentioned in the document (e.g. "10% Advance along with PO & balance payment 90% against Proforma Invoice before dispatch" or "100% within 30 days of delivery"). If not found, output null.
2. "deliverySchedule" (string): The delivery timeline or completion schedule required (e.g., "Within 12 weeks from approval" or "As per tender schedule"). If not found, output null.
3. "tpiTerms" (string): Third-party inspection (TPI) agency or inspection terms (e.g. "Inspection by LLOYDS/TPIA" or "CE/IBR certification required"). If not found, output null.
4. "guaranteeTerms" (string): Guarantee/warranty period specified (e.g., "18 months from supply or 12 months from commissioning"). If not found, output null.
5. "validityTerms" (string): Bid or quotation validity period (e.g. "120 days from bid opening"). If not found, output null.
6. "priceBasis" (string): Price basis terms (e.g. "Ex-works", "FOR Destination", "FOB"). If not found, output null.
7. "freightTerms" (string): Who pays for freight (e.g., "Freight paid by buyer", "Inclusive of freight"). If not found, output null.
8. "packingForwardingTerms" (string): Packaging requirements (e.g. "Seaworthy wooden box packing required"). If not found, output null.
9. "technicalDeviations" (string): Any special compliance requirements or deviations from standard design mentioned in the tender specifications (e.g., "Special dual-plate configuration required, compliance with NACE MR0175 required"). If not found, output null.

Return ONLY raw JSON. No explanations.`;

  const callAI = async (provider, url, buildPayload, parseResponse) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: buildPayload.headers,
        body: JSON.stringify(buildPayload.body)
      });
      if (res.ok) {
        const result = await res.json();
        const rawText = parseResponse(result);
        if (rawText) {
          return JSON.parse(rawText.trim());
        }
      }
    } catch (err) {
      console.error(`[AI Term Extraction] ${provider} failed:`, err.message);
    }
    return null;
  };

  // 1. Try Groq
  if (process.env.GROQ_API_KEY) {
    const result = await callAI('Groq', 'https://api.groq.com/openai/v1/chat/completions', {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: { model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } }
    }, r => r.choices?.[0]?.message?.content);
    if (result) return normalizeExtractedTerms(result);
  }

  // 2. Try Gemini
  if (process.env.GEMINI_API_KEY) {
    const result = await callAI('Gemini', `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      headers: { 'Content-Type': 'application/json' },
      body: { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }
    }, r => r.candidates?.[0]?.content?.parts?.[0]?.text);
    if (result) return normalizeExtractedTerms(result);
  }

  // 3. Try OpenAI
  if (process.env.OPENAI_API_KEY) {
    const result = await callAI('OpenAI', 'https://api.openai.com/v1/chat/completions', {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: { model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } }
    }, r => r.choices?.[0]?.message?.content);
    if (result) return normalizeExtractedTerms(result);
  }

  return {};
};

function normalizeExtractedTerms(data) {
  const cleaned = {};
  const fields = ['paymentTerms', 'deliverySchedule', 'tpiTerms', 'guaranteeTerms', 'validityTerms', 'priceBasis', 'freightTerms', 'packingForwardingTerms', 'technicalDeviations'];
  fields.forEach(f => {
    if (data[f] && typeof data[f] === 'string' && data[f].trim().length > 0 && data[f] !== 'null') {
      cleaned[f] = data[f].trim();
    }
  });
  return cleaned;
}

/**
 * Suggests fields and technical dynamic specifications for an enquiry based on customer purchase history.
 */
exports.suggestEnquiryFields = async (productCategory, productDescription, customerHistory = []) => {
  console.log(`[AI Suggestion] Generating suggestions for category "${productCategory}" and description "${productDescription}". Past enquiries: ${customerHistory.length}`);

  const historyText = customerHistory.map((item, idx) => {
    return `Enquiry #${idx + 1}:
Category: ${item.productCategory}
Description: ${item.productDescription}
Quantity: ${item.quantity} ${item.unit}
Standard: ${item.standardCode || 'Not specified'}
Special Requirements: ${item.specialRequirements || 'None'}
Priority: ${item.priority || 'Medium'}
Technical Specifications: ${JSON.stringify(item.dynamicFields || {})}
---`;
  }).join('\n');

  const prompt = `You are an expert sales engineering assistant for Petro Valve.
A sales agent is creating a new enquiry for a customer.

Here is the customer's history of previous enquiries (most recent first):
${historyText || 'No previous history available.'}

The sales agent has entered the following minimal info for the new enquiry:
- Product Category: ${productCategory}
- Product Description: ${productDescription}

Based on this customer's history (if any) and standard engineering specifications for "${productDescription}" under category "${productCategory}", suggest the most likely values for the remaining fields:
1. "standardCode": Must match exactly one of: "ASME", "IS", "BS", "EN", "API", "IBR", "Custom", "Not specified".
2. "quantity": A suggested quantity (number).
3. "unit": Must match exactly one of: "NOS", "SET", "MT", "KG", "M", "M2", "Job".
4. "priority": Must match exactly one of: "Low", "Medium", "High", "Urgent".
5. "specialRequirements": Suggest a short summary of any special requirements or inspections (max 400 characters).
6. "dynamicFields": Suggest technical specifications (key-value pairs) appropriate for this category and product. Suggest keys and values that are relevant. For example:
   - For Piping: designTempC, designPressureBar, pipeSizeInch, pipeSchedule, materialGrade.
   - For Pressure Vessel: shellMaterial, headMaterial, capacityLitres, workingPressureBar.
   - For Heat Exchanger: tubeMaterial, shellMaterial, heatTransferAreaSqM, workingTempC.

Return ONLY a JSON object containing the suggested fields and an explanation of why they were suggested (do not wrap in markdown code blocks, return ONLY raw JSON):
{
  "suggestions": {
    "standardCode": "...",
    "quantity": 1,
    "unit": "...",
    "priority": "...",
    "specialRequirements": "...",
    "dynamicFields": {
      "key1": "value1",
      "key2": "value2"
    }
  },
  "explanation": "..."
}
Do not wrap the JSON in markdown code blocks. Return ONLY the raw JSON string.`;

  const callAI = async (provider, url, buildPayload, parseResponse) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: buildPayload.headers,
        body: JSON.stringify(buildPayload.body)
      });
      if (res.ok) {
        const result = await res.json();
        const rawText = parseResponse(result);
        if (rawText) {
          return JSON.parse(rawText.trim());
        }
      }
    } catch (err) {
      console.error(`[AI Suggestion] ${provider} failed:`, err.message);
    }
    return null;
  };

  // 1. Try Groq
  if (process.env.GROQ_API_KEY) {
    const result = await callAI('Groq', 'https://api.groq.com/openai/v1/chat/completions', {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: { model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } }
    }, r => r.choices?.[0]?.message?.content);
    if (result) return result;
  }

  // 2. Try Gemini
  if (process.env.GEMINI_API_KEY) {
    const result = await callAI('Gemini', `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      headers: { 'Content-Type': 'application/json' },
      body: { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }
    }, r => r.candidates?.[0]?.content?.parts?.[0]?.text);
    if (result) return result;
  }

  // 3. Try OpenAI
  if (process.env.OPENAI_API_KEY) {
    const result = await callAI('OpenAI', 'https://api.openai.com/v1/chat/completions', {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: { model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } }
    }, r => r.choices?.[0]?.message?.content);
    if (result) return result;
  }

  // Fallback default suggestions
  return {
    suggestions: {
      standardCode: 'Not specified',
      quantity: 1,
      unit: 'NOS',
      priority: 'Medium',
      specialRequirements: '',
      dynamicFields: {}
    },
    explanation: 'No AI service available. Returned default specifications.'
  };
};

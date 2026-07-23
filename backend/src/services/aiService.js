const crypto = require('crypto');
const { logActivity } = require('../utils/logger');
const aiConfig = require('../config/aiConfig');
const aiLogger = require('../utils/aiLogger');
const extractionPipeline = require('./extraction/ExtractionPipeline');
const normalizationService = require('./extraction/NormalizationService');

// Part 2: Custom Production-Grade Errors
class RetryableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RetryableError';
    this.rateLimited = true;
    this.retryable = true;
  }
}

class ExtractionFailedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ExtractionFailedError';
    this.nonRetryable = true;
  }
}

// Normalizes AI product category outputs to the Mongoose Enquiry enum
const PRODUCT_CATEGORIES = [
  'Pressure Vessel',
  'Heat Exchanger',
  'Storage Tank',
  'Valves',
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

// Conversion map for inch to mm NB sizing
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

/**
 * Helper to safely parse and clean JSON output from LLMs
 */
function tryParseJson(text) {
  if (!text) return null;
  let cleanText = text.trim();
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```(json)?/, '').replace(/```$/, '').trim();
  }
  try {
    return JSON.parse(cleanText);
  } catch (err) {
    console.warn('[AI Service] Failed to parse JSON. Raw content snippet:', cleanText.substring(0, 300));
    return null;
  }
}

/**
 * Unified fallback AI requester with timeouts, structured JSON validation, and 1x retry on JSON parse failures.
 * cascade chain: OpenAI -> Gemini -> Groq -> RetryableError / ExtractionFailedError
 */
async function callAIServiceWithFallback({ prompt, validateFn = () => true, logTag = 'AI Service', enquiryId = 'SYSTEM' }) {
  const startTime = Date.now();

  let anySucceeded = false;
  let anyRateLimited = false;
  let anyServerError = false;
  let parsedResult = null;
  const attempts = [];

  const fetchWithTimeout = async (url, options) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), aiConfig.AI_TIMEOUT);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  };

  const attemptProvider = async (providerName, modelName, executeFetch, extractTextFn) => {
    let currentPrompt = prompt;

    for (let attemptNum = 1; attemptNum <= 2; attemptNum++) {
      const attemptStartTime = Date.now();
      let httpStatus = 0;
      let errorReason = '';

      try {
        console.log(`[${logTag}] Attempting ${providerName} (${modelName}) - Attempt ${attemptNum}...`);
        const res = await executeFetch(currentPrompt);
        httpStatus = res.status;

        if (res.ok) {
          const body = await res.json();
          const rawText = extractTextFn(body);
          const parsed = tryParseJson(rawText);

          if (parsed && validateFn(parsed)) {
            attempts.push({
              provider: providerName,
              model: modelName,
              attempt: attemptNum,
              processingTime: Date.now() - attemptStartTime,
              status: 'success',
              httpStatus
            });
            parsedResult = parsed;
            anySucceeded = true;

            aiLogger.logAIRequestResponse(
              enquiryId,
              `${logTag}_${providerName}_Attempt${attemptNum}`,
              { prompt: currentPrompt, provider: providerName, model: modelName, attempt: attemptNum },
              { httpStatus, body }
            );

            return true;
          } else {
            errorReason = 'JSON_VALIDATE_FAILED';
            console.warn(`[${logTag}] ${providerName} (${modelName}) returned invalid JSON format or failed custom validation.`);

            aiLogger.logAIRequestResponse(
              enquiryId,
              `${logTag}_${providerName}_Attempt${attemptNum}_Validation_Failed`,
              { prompt: currentPrompt, provider: providerName, model: modelName, attempt: attemptNum },
              { httpStatus, body, rawText, parsed }
            );
          }
        } else if (res.status === 429) {
          anyRateLimited = true;
          errorReason = '429 Rate Limited';
          console.warn(`[${logTag}] ${providerName} (${modelName}) rate limited.`);

          aiLogger.logAIRequestResponse(
            enquiryId,
            `${logTag}_${providerName}_Attempt${attemptNum}_429`,
            { prompt: currentPrompt, provider: providerName, model: modelName, attempt: attemptNum },
            { httpStatus, error: 'Rate Limited' }
          );

          break; // Skip retry on 429, cascade to next provider immediately
        } else {
          anyServerError = true;
          errorReason = `HTTP Error ${res.status}`;
          const errText = await res.text().catch(() => '');
          console.error(`[${logTag}] ${providerName} (${modelName}) error: ${errText.substring(0, 200)}`);

          aiLogger.logAIRequestResponse(
            enquiryId,
            `${logTag}_${providerName}_Attempt${attemptNum}_Error`,
            { prompt: currentPrompt, provider: providerName, model: modelName, attempt: attemptNum },
            { httpStatus, error: errText }
          );
        }
      } catch (err) {
        let isTimeout = err.name === 'AbortError';
        if (isTimeout) {
          anyServerError = true;
          errorReason = 'Timeout (Abort)';
          console.error(`[${logTag}] ${providerName} (${modelName}) request timed out after ${aiConfig.AI_TIMEOUT}ms.`);
        } else {
          anyServerError = true;
          errorReason = err.message;
          console.error(`[${logTag}] ${providerName} (${modelName}) fetch error:`, err.message);
        }

        aiLogger.logAIRequestResponse(
          enquiryId,
          `${logTag}_${providerName}_Attempt${attemptNum}_Exception`,
          { prompt: currentPrompt, provider: providerName, model: modelName, attempt: attemptNum },
          { error: err.message, isTimeout, stack: err.stack }
        );
      }

      attempts.push({
        provider: providerName,
        model: modelName,
        attempt: attemptNum,
        processingTime: Date.now() - attemptStartTime,
        status: 'failed',
        reason: errorReason,
        httpStatus
      });

      if (anyRateLimited || anyServerError) {
        break; // Cascade to next provider immediately
      }

      if (attemptNum === 1) {
        console.log(`[${logTag}] Retrying ${providerName} once with invalid JSON warning...`);
        currentPrompt = prompt + `\n\nCRITICAL: You returned invalid JSON in your previous attempt. Return ONLY a valid, parseable JSON object matching the instructions above. Do not include markdown code block formatting, explanations, or text before/after.`;
      }
    }
    return false;
  };

  // 1. Try OpenAI (Primary)
  if (process.env.OPENAI_API_KEY) {
    const success = await attemptProvider(
      'OpenAI',
      aiConfig.PRIMARY_MODEL,
      async (p) => fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: aiConfig.PRIMARY_MODEL,
          messages: [{ role: 'user', content: p }],
          response_format: { type: 'json_object' }
        })
      }),
      (body) => body.choices?.[0]?.message?.content
    );
    if (success) return { result: parsedResult, attempts };
  }

  // 2. Try Gemini (Fallback)
  if (process.env.GEMINI_API_KEY) {
    for (const modelName of aiConfig.GEMINI_MODELS) {
      const success = await attemptProvider(
        'Gemini',
        modelName,
        async (p) => fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: p }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        }),
        (body) => body.candidates?.[0]?.content?.parts?.[0]?.text
      );
      if (success) return { result: parsedResult, attempts };
    }
  }

  // 3. Try Groq (Fallback)
  if (process.env.GROQ_API_KEY) {
    const success = await attemptProvider(
      'Groq',
      aiConfig.GROQ_MODEL,
      async (p) => fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: aiConfig.GROQ_MODEL,
          messages: [{ role: 'user', content: p }],
          response_format: { type: 'json_object' }
        })
      }),
      (body) => body.choices?.[0]?.message?.content
    );
    if (success) return { result: parsedResult, attempts };
  }

  // Exhausted all providers
  const totalTime = Date.now() - startTime;
  console.error(`[${logTag}] All AI providers exhausted. Attempts summary:`, JSON.stringify(attempts));

  if (anyRateLimited) {
    throw new RetryableError(`All AI providers rate limited or exhausted. Attempts: ${JSON.stringify(attempts)}`);
  }

  throw new ExtractionFailedError(`AI extraction failed permanently across all providers. Attempts: ${JSON.stringify(attempts)}`);
}

/**
 * Extracts a list of enquiries and customer details from email body and attachments.
 * Part 3, 4, 5: strict OpenAI-first, Prompt instructions, JSON validation
 */
exports.extractEnquiries = async (emailText, attachments = [], metadata = {}) => {
  const fromAddress = metadata.from || '';
  const subjectText = metadata.subject || '';

  console.log(`[AI Multi-Extraction] Processing email from "${fromAddress}"`);

  // Format attachments list for prompt context (capped per attachment to prevent token overflow)
  const attachmentsListStr = (attachments || []).map((att, index) => {
    const trimmedText = (att.extractedText || '').slice(0, aiConfig.MAX_ATTACHMENT_TEXT);
    const truncNote = (att.extractedText || '').length > aiConfig.MAX_ATTACHMENT_TEXT ? ' [TRUNCATED]' : '';
    return `Attachment #${index + 1}:
Filename: ${att.originalFileName}
Category: ${att.attachmentCategory || 'Unknown'}
Extracted Text Content:
"""
${trimmedText || '(No text content extracted)'}${truncNote}
"""`;
  }).join('\n\n');

  // Part 5: Improved Prompt (Return ONLY JSON, no markdown/code blocks, null if not found, use attachment context only)
  const prompt = `You are a requirements gathering bot.
Read the customer email request and its attachments:

Sender Info (From): ${fromAddress}
Subject: ${subjectText}
Email Body:
"""
${emailText}
"""

Parsed Email Attachments:
${attachmentsListStr || 'None'}

Extract customer contact details, and split the request into one or more product enquiries.
CRITICAL FOCUS:
- Treat every Schedule, SOR row, BOQ row, material line item, equipment tag, and specification sheet as an independent product.
- Never merge products. If 18 products exist, return exactly 18 JSON objects.
- Search every attachment before concluding a product does not exist.
- Ignore table of contents, legal clauses, and commercial terms unless they contain product information.
- Do NOT attempt to extract custom technical specs (e.g. design temperature, MOC, pressure class, head type, shell thickness, capacity) in this pass. Focus solely on building the general catalog list of products.
- IMPORTANT: Carefully scan ALL attachment content (PDFs, tenders, images) for Client/Owner name and PMC/EPCM/Consultant name. These may appear in:
  * Document headers, letterheads, or title pages
  * Fields like "Owner:", "Client:", "End User:", "Project Owner:", "Employer:"
  * Fields like "PMC:", "EPCM:", "Consultant:", "Project Management Consultant:", "Engineering Consultant:", "EPC Contractor:"
  * They can be indirectly mentioned — e.g. a company name appearing alongside project details

Return ONLY a valid JSON object matching the schema below. Do not wrap in markdown blocks, explanations, comments, or headers.

Schema:
{
  "isEnquiry": true/false (true if this is a genuine inquiry for Petro Valve's industrial valves, vessels, piping, or tanks),
  "companyName": "...", (the company/person who SENT the email, or "Individual Customer" if unknown),
  "primaryContactName": "...", (or "Email Sender" if unknown),
  "mobileNumber": "...", (or "0000000000" if unknown),
  "clientName": "...", (the END CLIENT / OWNER of the project — NOT the sender. Look in attachments. null if not found),
  "pmcConsultant": "...", (PMC / EPCM / Engineering Consultant for the project. Look in attachments. null if not found),
  "enquiries": [
    {
      "productCategory": "Valves" / "Pressure Vessel" / "Heat Exchanger" / "Storage Tank" / "Structural" / "Custom" / "Multiple",
      "productDescription": "...", (max 200 chars summary of product, e.g. "CS Ball Valve 100mm"),
      "quantity": 1,
      "unit": "NOS" / "SET" / "MT" / "KG" / "M" / "M2" / "Job",
      "standardCode": "ASME" / "IS" / "BS" / "EN" / "API" / "IBR" / "Custom" / "Not specified",
      "specialRequirements": "...", (max 400 chars, e.g. NACE MR0175, TPI, paint spec),
      "priority": "Low" / "Medium" / "High" / "Urgent",
      "confidence": 0-100,
      "linkedAttachmentNames": ["..."] (filenames of attachments containing specs for this item)
    }
  ]
}

If information cannot be extracted, return null for that field. Never invent values. Use attachment content only.`;

  const validateFn = (data) => {
    return data && typeof data === 'object' && data.isEnquiry !== undefined;
  };

  const { result, attempts } = await callAIServiceWithFallback({
    prompt,
    validateFn,
    logTag: 'AI Multi-Extraction',
    enquiryId: metadata.enquiryId || 'NEW_ENQUIRY'
  });

  const normalized = cleanAndNormalizeMultiResult(result, fromAddress);
  normalized.extractionMetadata = {
    provider: attempts[attempts.length - 1]?.provider,
    model: attempts[attempts.length - 1]?.model,
    attemptsCount: attempts.length,
    processingTime: attempts.reduce((sum, a) => sum + a.processingTime, 0),
    attempts
  };

  return normalized;
};

/**
 * Normalizes values of multi-enquiry AI output to match schemas perfectly.
 */
function cleanAndNormalizeMultiResult(data, defaultFromEmail) {
  if (!data || data.isEnquiry === false || !data.enquiries || !Array.isArray(data.enquiries)) {
    return {
      isEnquiry: false,
      companyName: 'Individual Customer',
      primaryContactName: 'Email Sender',
      mobileNumber: '0000000000',
      enquiries: []
    };
  }

  let mobile = String(data.mobileNumber || '').trim().replace(/[^0-9+]/g, '');
  if (!mobile || mobile.length < 5) {
    mobile = '0000000000';
  }

  const cleanedEnquiries = data.enquiries.map(item => {
    let category = item.productCategory;
    if (!PRODUCT_CATEGORIES.includes(category)) {
      category = category?.toLowerCase().includes('valve') ? 'Valves' : 'Custom';
    }

    let std = item.standardCode;
    if (std && typeof std === 'string') {
      const parts = std.split(/[\s,\/&]+/)
        .map(p => p.trim())
        .filter(p => {
          const matched = STANDARD_CODES.find(sc => sc.toLowerCase() === p.toLowerCase());
          return matched && matched !== 'Not specified' && matched !== 'Custom';
        })
        .map(p => STANDARD_CODES.find(sc => sc.toLowerCase() === p.toLowerCase()));
      if (parts.length > 0) {
        std = [...new Set(parts)].join(', ');
      } else if (std.toLowerCase().includes('custom')) {
        std = 'Custom';
      } else {
        std = 'Not specified';
      }
    } else {
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
    clientName: data.clientName ? String(data.clientName).trim() : null,
    pmcConsultant: data.pmcConsultant ? String(data.pmcConsultant).trim() : null,
    enquiries: cleanedEnquiries
  };
}

/**
 * Intelligent context retrieval to chunk large documents.
 * Part 7 & 8: Context Selection using dynamic weights.
 */
function getRelevantContext(text, productDescription, relevantFields, maxChars = aiConfig.MAX_CONTEXT_SIZE) {
  if (!text || text.length <= maxChars) return text;

  console.log(`[AI Context Filter] Original text size: ${text.length} chars. Filtering down to ${maxChars} chars...`);

  // Split into chunks of 3000 characters with 500 characters overlap
  const chunkSize = 3000;
  const overlap = 500;
  const chunks = [];

  for (let i = 0; i < text.length; i += (chunkSize - overlap)) {
    const chunk = text.substring(i, i + chunkSize);
    chunks.push({
      text: chunk,
      index: i,
      score: 0,
      matchedHigh: [],
      matchedLow: []
    });
  }

  // Keywords defined for Phase 2
  const HIGH_RANK_KEYWORDS = [
    'schedule', 'boq', 'sor', 'qty', 'quantity', 'item no', 'item number', 'line item',
    'valve data sheet', 'datasheet', 'api', 'pressure class', 'class', 'size', 'dn',
    'material', 'moc', 'actuator', 'motorized'
  ];

  const EXCLUSION_KEYWORDS = [
    'terms', 'conditions', 'legal', 'nda', 'proprietary', 'force majeure', 'arbitration',
    'indemnity', 'liabilities', 'warranties'
  ];

  const searchTerms = new Set();

  if (productDescription) {
    productDescription.toLowerCase().split(/\s+/).forEach(word => {
      if (word.length > 2) searchTerms.add(word);
    });
  }

  for (const f of relevantFields) {
    f.fieldLabel.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).forEach(word => {
      if (word.length > 2) searchTerms.add(word);
    });
    f.fieldName.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).forEach(word => {
      if (word.length > 2) searchTerms.add(word);
    });
    if (f.options && f.options.length) {
      f.options.forEach(opt => {
        String(opt).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).forEach(word => {
          if (word.length > 2) searchTerms.add(word);
        });
      });
    }
  }

  const termsArr = Array.from(searchTerms);

  // Score each chunk (Phase 2)
  for (const chunk of chunks) {
    const chunkLower = chunk.text.toLowerCase();

    // Exact description match
    if (productDescription && chunkLower.includes(productDescription.toLowerCase())) {
      chunk.score += 200;
    }

    // High-rank keywords (+100 each)
    for (const kw of HIGH_RANK_KEYWORDS) {
      if (chunkLower.includes(kw)) {
        chunk.score += 100;
        chunk.matchedHigh.push(kw);
      }
    }

    // Exclusion keywords (-150 each)
    for (const kw of EXCLUSION_KEYWORDS) {
      if (chunkLower.includes(kw)) {
        chunk.score -= 150;
        chunk.matchedLow.push(kw);
      }
    }

    // Generic search terms (+10 each)
    for (const term of termsArr) {
      if (chunkLower.includes(term)) {
        chunk.score += 10;
      }
    }
  }

  const sortedChunks = [...chunks].sort((a, b) => b.score - a.score);
  const selectedChunks = [];
  let currentLength = 0;

  for (const chunk of sortedChunks) {
    if (currentLength + chunk.text.length > maxChars) {
      if (selectedChunks.length > 0) break;
    }
    selectedChunks.push(chunk);
    currentLength += chunk.text.length;

    // Log why this page/chunk was selected (Phase 2 Requirement)
    console.log(`[AI Context Filter] Selected chunk at offset ${chunk.index}: Score ${chunk.score}`);
    console.log(`  - High-rank keywords matched: [${chunk.matchedHigh.join(', ')}]`);
    console.log(`  - Exclusion keywords matched: [${chunk.matchedLow.join(', ')}]`);
  }

  selectedChunks.sort((a, b) => a.index - b.index);

  // Phase 8: Overlapping Chunk deduplication & merging
  let filteredText = '';
  let lastEnd = 0;
  for (const chunk of selectedChunks) {
    if (chunk.index < lastEnd) {
      const overlapStart = lastEnd - chunk.index;
      filteredText += chunk.text.substring(overlapStart);
    } else {
      if (filteredText.length > 0) {
        filteredText += '\n... [section skipped] ...\n';
      }
      filteredText += chunk.text;
    }
    lastEnd = chunk.index + chunk.text.length;
  }

  // Phase 8 Log Requirement
  console.log(`[AI Context Filter] Retrieval Metrics:
  - Original chars: ${text.length}
  - Selected chunks: ${selectedChunks.length}
  - Final chars: ${filteredText.length}`);

  return filteredText;
}

/**
 * Dynamic Field Extractor from emails focusing on a target product description.
 * Part 21: respecting provider rate limits, validating types.
 */
exports.extractDynamicFields = async (emailText, fieldDefinitions, productDescription = '', enquiryId = 'SYSTEM') => {
  if (!fieldDefinitions || fieldDefinitions.length === 0) return {};

  const MAX_FIELDS = 100;
  let relevantFields = fieldDefinitions;

  if (fieldDefinitions.length > MAX_FIELDS) {
    const textLower = (emailText + ' ' + productDescription).toLowerCase();

    const scoreField = (f) => {
      let score = 0;
      if (f.isRequired) score += 100;
      const labelWords = f.fieldLabel.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2);
      for (const word of labelWords) {
        if (textLower.includes(word)) score += 10;
      }
      const nameWords = f.fieldName.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 2);
      for (const word of nameWords) {
        if (textLower.includes(word)) score += 5;
      }
      return score;
    };

    const scored = fieldDefinitions
      .map(f => ({ field: f, score: scoreField(f) }))
      .sort((a, b) => b.score - a.score);

    const required = scored.filter(s => s.field.isRequired).map(s => s.field);
    const optional = scored.filter(s => !s.field.isRequired).slice(0, MAX_FIELDS - required.length).map(s => s.field);
    relevantFields = [...required, ...optional];
  }

  // Part 7 & 8: Intelligent chunk filtering
  const filteredContextText = getRelevantContext(emailText, productDescription, relevantFields);

  const fieldListStr = relevantFields.map(f => {
    return `- "${f.fieldName}" (type: ${f.fieldType}, label: "${f.fieldLabel}"): ${f.placeholder || ''} ${f.options && f.options.length ? '(Options: ' + JSON.stringify(f.options) + ')' : ''}`;
  }).join('\n');

  let itemContextFocus = '';
  if (productDescription) {
    itemContextFocus = `
CRITICAL FOCUS:
We are extracting specifications specifically for this product item: "${productDescription}".
Ignore any specifications that belong to other product items mentioned in the text. Focus ONLY on this specific item and extract its matching specifications.
`;
  }

  // Part 5: strict output prompt (Return ONLY JSON, no code blocks, null if not found)
  const prompt = `You are a technical specification extraction bot.
Read the text context below:
"""
${filteredContextText}
"""
${itemContextFocus}

Extract values for these custom fields:
${fieldListStr}

CRITICAL FOCUS:
- Extract specifications and values ONLY for the current product: "${productDescription}".
- Ignore specifications of any unrelated products.
- Never invent or hallucinate values. If a field is not found or not mentioned in the context, you MUST return null for value, 0 for confidence, and null for sourcePage.
- For each extracted field, include value, confidence, and source page number.
- If the field is "valve_type" (Valve Type):
  * Extract the exact type of valve requested in the item description or context (e.g. "Ball Valve", "Gate Valve", "Globe Valve", "Check Valve", "Butterfly Valve", "Plug Valve", "Control Valve", "Needle Valve", "Safety Valve").
  * Do not extract end connection terms like "Flange Ended Valve" or "Butt Welded Valve" as the valve type — "Flange Ended" and "Butt Welded" belong to valve_end_connection.

Return ONLY a valid JSON object matching the schema below. Do not wrap in markdown blocks (no \`\`\`json). Do not add explanations or text before/after the JSON.

Schema:
{
${relevantFields.map(f => `  "${f.fieldName}": {
    "value": "extracted value" / number / boolean / null,
    "confidence": 0-100,
    "sourcePage": number / null
  }`).join(',\n')}
}
`;

  const validateFn = (data) => {
    return data && typeof data === 'object';
  };

  const { result } = await callAIServiceWithFallback({
    prompt,
    validateFn,
    logTag: 'AI Dynamic Extraction',
    enquiryId
  });

  // Zero-Hallucination Pipeline Overlay: Deterministic canonical extractions override LLM estimates
  try {
    const textToScan = `${productDescription}\n${emailText}`;
    const pipelineRes = extractionPipeline.processDocument(textToScan, { documentId: enquiryId });
    const legacy = pipelineRes.legacySpecifications || {};

    fieldDefinitions.forEach(f => {
      const k = f.fieldName;
      const lk = k.toLowerCase();
      let canonicalVal = null;

      if (lk.includes('size')) canonicalVal = legacy.valve_size;
      else if (lk.includes('class') || lk.includes('rating')) canonicalVal = legacy.valve_class;
      else if (lk.includes('type') && lk.includes('valve')) canonicalVal = legacy.valve_type;
      else if (lk.includes('material') || lk.includes('moc')) canonicalVal = legacy.shellMaterial;
      else if (lk.includes('standard')) canonicalVal = legacy.designStandard;

      if (canonicalVal) {
        result[k] = { value: canonicalVal, confidence: 100, sourcePage: 1 };
      }
    });
  } catch (pipeErr) {
    console.warn('[ExtractionPipeline Overlay Error]', pipeErr.message);
  }

  return normalizationService.normalizeExtractedFields(result, fieldDefinitions);
};

/**
 * Validates and normalizes extracted fields.
 * Delegated directly to NormalizationService as the single source of truth.
 */
function normalizeExtractedFields(data, fieldDefinitions) {
  return normalizationService.normalizeExtractedFields(data, fieldDefinitions);
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
  const found = [];
  if (/asme/i.test(text)) found.push('ASME');
  if (/api/i.test(text)) found.push('API');
  if (/ibr/i.test(text)) found.push('IBR');
  if (/is\s*\d+/i.test(text) || /\bis\b/i.test(text)) found.push('IS');
  if (/\bbs\b/i.test(text)) found.push('BS');
  if (/\ben\b/i.test(text)) found.push('EN');
  if (found.length > 0) {
    standard = found.join(', ');
  }

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
 * Part 3, 4, 5: strict OpenAI-first, prompt guidelines, JSON validation
 */
exports.classifyEmail = async (emailText, metadata = {}, attachmentNames = []) => {
  const fromAddress = metadata.from || '';
  const subjectText = metadata.subject || '';

  console.log(`[AI Classification] Classifying email from "${fromAddress}"`);

  const attachmentsList = attachmentNames.length > 0
    ? `Attachment Filenames: ${attachmentNames.join(', ')}`
    : 'No attachments';

  const prompt = `You are a requirements classification bot.
Classify this incoming email into EXACTLY ONE of these categories:

1. "Enquiry" — A new commercial request, Request for Quotation (RFQ), product inquiry, or price request.
2. "Tender" — A formal government/municipal/refinery tender notice, bid invitation, NIT (Notice Inviting Tender).
3. "Follow-up" — A status check, reply to an existing conversation, or query referencing previous enquiry ENQ-XXXX.
4. "Vendor Document" — Document from a supplier (MTC, inspection report, delivery challan, invoice).
5. "Spam/Other" — Promotional, newsletter, bounce, job application, auto-reply.

Email Details:
From: ${fromAddress}
Subject: ${subjectText}
${attachmentsList}

Email Body (first 3000 chars):
"""
${emailText.substring(0, 3000)}
"""

Return ONLY a valid JSON object matching the schema below. Do not wrap in markdown code blocks. Do not add explanations.

Schema:
{
  "category": "Enquiry" / "Tender" / "Follow-up" / "Vendor Document" / "Spam/Other",
  "confidence": 0-100,
  "reason": "One-line explanation",
  "tenderNumber": "..." (or null if not Tender),
  "tenderDeadline": "ISO Date String" (or null if not Tender),
  "referencedEnquiryIds": ["ENQ-XXXX"] (or empty array if not Follow-up)
}

If information cannot be extracted, return null. Never invent values.`;

  const validateFn = (data) => {
    return data && typeof data === 'object' && data.category !== undefined;
  };

  const { result } = await callAIServiceWithFallback({
    prompt,
    validateFn,
    logTag: 'AI Classification'
  });

  return normalizeClassification(result);
};

/**
 * Normalizes AI classification output.
 */
function normalizeClassification(data) {
  let category = data.category;
  if (!EMAIL_CATEGORIES.includes(category)) {
    const lower = (category || '').toLowerCase();
    if (lower.includes('tender') || lower.includes('nit') || lower.includes('bid')) category = 'Tender';
    else if (lower.includes('follow') || lower.includes('reply') || lower.includes('update')) category = 'Follow-up';
    else if (lower.includes('vendor') || lower.includes('supplier') || lower.includes('mtc')) category = 'Vendor Document';
    else if (lower.includes('spam') || lower.includes('other') || lower.includes('junk')) category = 'Spam/Other';
    else category = 'Enquiry';
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

  const tenderKeywords = ['tender', 'nit', 'notice inviting', 'bid invitation', 'eoi', 'expression of interest',
    'gem portal', 'earnest money', 'emd', 'bid submission', 'corrigendum', 'addendum',
    'procurement', 'rfp', 'request for proposal', 'municipal', 'public sector'];
  if (tenderKeywords.some(k => combined.includes(k))) {
    return { category: 'Tender', confidence: 75, reason: 'Tender keywords detected in subject/body', tenderNumber: null, tenderDeadline: null, referencedEnquiryIds: [] };
  }

  if (/^(re|fwd|fw)\s*:/i.test(subject.trim()) || /ENQ-\d{4}-\d{2}-\d{4}/i.test(combined)) {
    const refs = (combined.match(/ENQ-\d{4}-\d{2}-\d{4}/gi) || []).map(r => r.toUpperCase());
    return { category: 'Follow-up', confidence: 80, reason: 'Reply subject prefix or ENQ reference ID found', tenderNumber: null, tenderDeadline: null, referencedEnquiryIds: [...new Set(refs)] };
  }

  const vendorKeywords = ['mtc', 'material test certificate', 'inspection report', 'test report',
    'challan', 'delivery note', 'dispatch', 'invoice', 'proforma', 'quotation from',
    'material availability', 'stock available', 'rate list'];
  if (vendorKeywords.some(k => combined.includes(k) || attStr.includes(k))) {
    return { category: 'Vendor Document', confidence: 70, reason: 'Vendor/supplier document keywords detected', tenderNumber: null, tenderDeadline: null, referencedEnquiryIds: [] };
  }

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
 * Part 3, 4, 5: strict OpenAI-first, prompt guidelines, JSON validation
 */
exports.extractQuotationTerms = async (textContext) => {
  console.log(`[AI Term Extraction] Extracting commercial and compliance terms`);

  const prompt = `You are a contract compliance and estimation assistant.
Read the tender document text below:
"""
${textContext.substring(0, 10000)}
"""

Extract the commercial terms, delivery period, and quality/inspection compliance requirements. 
Return ONLY a valid JSON object matching this schema. Do not wrap in markdown code blocks. Do not add explanations.

Schema:
{
  "paymentTerms": "...", (or null if not found),
  "deliverySchedule": "...", (or null if not found),
  "tpiTerms": "...", (or null if not found),
  "guaranteeTerms": "...", (or null if not found),
  "validityTerms": "...", (or null if not found),
  "priceBasis": "...", (or null if not found),
  "freightTerms": "...", (or null if not found),
  "packingForwardingTerms": "...", (or null if not found),
  "technicalDeviations": "..." (or null if not found)
}

If information cannot be extracted, return null for that field. Never invent values.`;

  const validateFn = (data) => {
    return data && typeof data === 'object';
  };

  const { result } = await callAIServiceWithFallback({
    prompt,
    validateFn,
    logTag: 'AI Term Extraction'
  });

  return normalizeExtractedTerms(result);
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
 * Part 3, 4, 5: strict OpenAI-first, prompt guidelines, JSON validation
 */
exports.suggestEnquiryFields = async (productCategory, productDescription, customerHistory = []) => {
  console.log(`[AI Suggestion] Generating suggestions for category "${productCategory}"`);

  const historyText = customerHistory.map((item, idx) => {
    return `Enquiry #${idx + 1}:
Category: ${item.productCategory}
Description: ${item.productDescription}
Quantity: ${item.quantity} ${item.unit}
Standard: ${item.standardCode || 'Not specified'}
Special Requirements: ${item.specialRequirements || 'None'}
Technical Specifications: ${JSON.stringify(item.dynamicFields || {})}
---`;
  }).join('\n');

  const prompt = `You are a sales engineering assistant.
A sales agent is creating a new enquiry for a customer.

Customer previous history:
${historyText || 'No previous history available.'}

New enquiry inputs:
- Product Category: ${productCategory}
- Product Description: ${productDescription}

Suggest the most likely values for:
1. "standardCode": "ASME" / "IS" / "BS" / "EN" / "API" / "IBR" / "Custom" / "Not specified"
2. "quantity": number
3. "unit": "NOS" / "SET" / "MT" / "KG" / "M" / "M2" / "Job"
4. "priority": "Low" / "Medium" / "High" / "Urgent"
5. "specialRequirements": max 400 characters description
6. "dynamicFields": Suggested technical specifications (key-value pairs) appropriate for this category and product.

Return ONLY a valid JSON object matching the schema below. Do not wrap in markdown code blocks. Do not add explanations.

Schema:
{
  "suggestions": {
    "standardCode": "...",
    "quantity": 1,
    "unit": "...",
    "priority": "...",
    "specialRequirements": "...",
    "dynamicFields": {
      "key1": "value1"
    }
  },
  "explanation": "..."
}

If information cannot be suggested, return null. Never invent values.`;

  const validateFn = (data) => {
    return data && data.suggestions && typeof data.suggestions === 'object';
  };

  const { result } = await callAIServiceWithFallback({
    prompt,
    validateFn,
    logTag: 'AI Suggestion'
  });

  return result;
};

/**
 * Classifies a parsed attachment using the fallback chain of AI models (OpenAI-first).
 * Part of Phase 1.
 * 
 * @param {string} fileName Filename of the attachment
 * @param {string} textSnippet A snippet of the extracted/OCR text (typically first 2000 chars)
 * @returns {Promise<object>} { category, confidence }
 */
exports.classifyAttachmentAgent = async (fileName, textSnippet = '') => {
  console.log(`[AI Attachment Classification] Classifying file: "${fileName}"`);

  const ATTACHMENT_CATEGORIES = [
    'BOQ',
    'Technical Specification',
    'Commercial',
    'Datasheet',
    'Drawing',
    'Corrigendum',
    'Vendor Query',
    'Price Bid',
    'Annexure',
    'General Tender',
    'Purchase Order',
    'Inspection Document',
    'Quality Plan',
    'Unknown'
  ];

  const prompt = `You are a document classification bot.
Your job is to read the file name and a snippet of its text content, and classify it into EXACTLY ONE of the following 14 categories:

- "BOQ" (Bill of Quantities, schedules of items, price schedules with blank rates, spreadsheet tables containing product rows and quantities)
- "Technical Specification" (Detailed technical requirements, specification sheets, project standards, engineering specifications)
- "Commercial" (Bid terms, commercial guidelines, instructions to bidders, payment terms, legal requirements, qualification criteria)
- "Datasheet" (Product-specific data sheets, valve data sheets, tag lists, dimensional specs)
- "Drawing" (CAD layouts, dimensional drawings, GA drawings, piping isometric drawings)
- "Corrigendum" (Tender amendments, timeline extensions, reply to pre-bid queries, corrigenda)
- "Vendor Query" (Pre-bid clarifications, queries raised by suppliers, clarification logs)
- "Price Bid" (Priced schedule, financial bid format, commercial bid price sheets)
- "Annexure" (Annexures, exhibits, standard formats for certificates or declarations)
- "General Tender" (Notice Inviting Tender, NIT cover page, brief summary of tender scope)
- "Purchase Order" (Formal buyer-seller agreement, PO, release order)
- "Inspection Document" (Third-party inspection certificates, release certificates, material test certificates (MTC))
- "Quality Plan" (Quality assurance plans, QAP, inspection test plans, testing check sheets)
- "Unknown" (Any document that does not fit any category above)

File Details:
File Name: ${fileName}
Text Content Snippet:
"""
${textSnippet.substring(0, 2000)}
"""

Return ONLY a valid JSON object matching the schema below. Do not wrap in markdown code blocks. Do not add explanations.

Schema:
{
  "category": "BOQ" / "Technical Specification" / "Commercial" / "Datasheet" / "Drawing" / "Corrigendum" / "Vendor Query" / "Price Bid" / "Annexure" / "General Tender" / "Purchase Order" / "Inspection Document" / "Quality Plan" / "Unknown",
  "confidence": 0-100
}
`;

  const validateFn = (data) => {
    return data && typeof data === 'object' && ATTACHMENT_CATEGORIES.includes(data.category);
  };

  try {
    const { result } = await callAIServiceWithFallback({
      prompt,
      validateFn,
      logTag: 'AI Attachment Classification'
    });
    return {
      category: result.category,
      confidence: parseInt(result.confidence, 10) || 80
    };
  } catch (err) {
    console.error(`[AI Attachment Classification] AI failed to classify, returning Unknown. Error:`, err.message);
    return {
      category: 'Unknown',
      confidence: 0
    };
  }
};

module.exports.RetryableError = RetryableError;
module.exports.ExtractionFailedError = ExtractionFailedError;
module.exports.getRelevantContext = getRelevantContext;

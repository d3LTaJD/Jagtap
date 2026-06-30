/**
 * Tender Intelligence Extraction Service
 * 
 * Performs a comprehensive AI extraction of all tender-level metadata from
 * parsed document text. Extracts 14 categories of information including
 * tender details, project info, SOR tables, commercial terms, timelines,
 * contacts, qualification criteria, standards, and annexures.
 * 
 * Uses the same callAIServiceWithFallback cascade (OpenAI → Gemini → Groq)
 * as the core aiService.
 */

const aiConfig = require('../config/aiConfig');
const aiLogger = require('../utils/aiLogger');

// ── Re-use the shared AI call infrastructure from aiService ──
const { RetryableError, ExtractionFailedError, getRelevantContext } = require('./aiService');

// ── Local helpers ────────────────────────────────────────────

function tryParseJson(text) {
  if (!text) return null;
  let cleanText = text.trim();
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```(json)?/, '').replace(/```$/, '').trim();
  }
  try {
    return JSON.parse(cleanText);
  } catch (err) {
    console.warn('[Tender Intelligence] Failed to parse JSON. Raw content snippet:', cleanText.substring(0, 300));
    return null;
  }
}

/**
 * callTenderAI — local AI caller with longer timeout for large tender prompts.
 */
async function callTenderAI({ prompt, validateFn = () => true, logTag = 'Tender Intelligence', enquiryId = 'SYSTEM' }) {
  const startTime = Date.now();
  const TENDER_AI_TIMEOUT = Math.max(aiConfig.AI_TIMEOUT, 120000);

  let anySucceeded = false;
  let anyRateLimited = false;
  let anyServerError = false;
  let parsedResult = null;
  const attempts = [];

  const fetchWithTimeout = async (url, options) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TENDER_AI_TIMEOUT);
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
              provider: providerName, model: modelName, attempt: attemptNum,
              processingTime: Date.now() - attemptStartTime, status: 'success', httpStatus
            });
            parsedResult = parsed;
            anySucceeded = true;
            aiLogger.logAIRequestResponse(enquiryId, `${logTag}_${providerName}_Attempt${attemptNum}`,
              { provider: providerName, model: modelName, attempt: attemptNum }, { httpStatus });
            return true;
          } else {
            errorReason = 'JSON_VALIDATE_FAILED';
            console.warn(`[${logTag}] ${providerName} (${modelName}) returned invalid JSON format.`);
          }
        } else if (res.status === 429) {
          anyRateLimited = true;
          errorReason = '429 Rate Limited';
          break;
        } else {
          anyServerError = true;
          errorReason = `HTTP Error ${res.status}`;
          const errText = await res.text().catch(() => '');
          console.error(`[${logTag}] ${providerName} error: ${errText.substring(0, 200)}`);
        }
      } catch (err) {
        anyServerError = true;
        errorReason = err.name === 'AbortError' ? 'Timeout' : err.message;
        console.error(`[${logTag}] ${providerName} (${modelName}) error:`, errorReason);
      }

      attempts.push({
        provider: providerName, model: modelName, attempt: attemptNum,
        processingTime: Date.now() - attemptStartTime, status: 'failed', reason: errorReason, httpStatus
      });

      if (anyRateLimited || anyServerError) break;

      if (attemptNum === 1) {
        currentPrompt = prompt + `\n\nCRITICAL: You returned invalid JSON. Return ONLY valid, parseable JSON. No markdown blocks, no explanations.`;
      }
    }
    return false;
  };

  // 1. OpenAI
  if (process.env.OPENAI_API_KEY) {
    const success = await attemptProvider('OpenAI', aiConfig.PRIMARY_MODEL,
      async (p) => fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: aiConfig.PRIMARY_MODEL, messages: [{ role: 'user', content: p }], response_format: { type: 'json_object' } })
      }),
      (body) => body.choices?.[0]?.message?.content
    );
    if (success) return { result: parsedResult, attempts };
  }

  // 2. Gemini
  if (process.env.GEMINI_API_KEY) {
    for (const modelName of aiConfig.GEMINI_MODELS) {
      const success = await attemptProvider('Gemini', modelName,
        async (p) => fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: p }] }], generationConfig: { responseMimeType: "application/json" } })
        }),
        (body) => body.candidates?.[0]?.content?.parts?.[0]?.text
      );
      if (success) return { result: parsedResult, attempts };
    }
  }

  // 3. Groq
  if (process.env.GROQ_API_KEY) {
    const success = await attemptProvider('Groq', aiConfig.GROQ_MODEL,
      async (p) => fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({ model: aiConfig.GROQ_MODEL, messages: [{ role: 'user', content: p }], response_format: { type: 'json_object' } })
      }),
      (body) => body.choices?.[0]?.message?.content
    );
    if (success) return { result: parsedResult, attempts };
  }

  console.error(`[${logTag}] All AI providers exhausted.`);
  if (anyRateLimited) throw new RetryableError('All AI providers rate limited for tender intelligence.');
  throw new ExtractionFailedError('Tender intelligence extraction failed across all providers.');
}

// ── Main API ─────────────────────────────────────────────────

/**
 * Extract comprehensive tender intelligence from the full text context.
 */
async function extractTenderIntelligence(fullTextContext, sourceFileNames = [], enquiryId = 'SYSTEM') {
  if (!fullTextContext || fullTextContext.trim().length < 50) {
    console.warn(`[Tender Intelligence] Insufficient text context (${fullTextContext?.length || 0} chars). Returning empty.`);
    return buildEmptyResult(sourceFileNames);
  }

  console.log(`[Tender Intelligence] Starting extraction for ${enquiryId}. Context: ${fullTextContext.length} chars, Files: ${sourceFileNames.join(', ')}`);

  // Split into 2 passes to avoid token overflow:
  // Pass 1: Tender metadata, project, scope, timeline, commercial, contacts, qualifications, standards, annexures
  // Pass 2: Full SOR table extraction (the largest section)
  const metadataResult = await extractTenderMetadata(fullTextContext, sourceFileNames, enquiryId);
  const sorResult = await extractSORTable(fullTextContext, enquiryId);

  const result = {
    ...metadataResult,
    scheduleOfRates: sorResult.scheduleOfRates || [],
    productSummaryBySchedule: sorResult.productSummaryBySchedule || [],
    metadata: {
      extractedAt: new Date().toISOString(),
      sourceFiles: sourceFileNames,
      extractionConfidence: Math.round(
        ((metadataResult._confidence || 0) + (sorResult._confidence || 0)) / 2
      ),
      totalPasses: 2,
      textLength: fullTextContext.length
    }
  };

  result.missingFields = buildMissingFieldsReport(result);
  delete result._confidence;

  console.log(`[Tender Intelligence] Extraction complete for ${enquiryId}. Missing fields: ${result.missingFields.length}`);
  return result;
}

/**
 * Pass 1: Extract tender metadata (everything except SOR table)
 */
async function extractTenderMetadata(fullTextContext, sourceFileNames, enquiryId) {
  const maxMetadataContext = 25000;
  const contextForMetadata = fullTextContext.length > maxMetadataContext
    ? fullTextContext.substring(0, maxMetadataContext) : fullTextContext;

  const prompt = `You are an expert tender document analysis bot for an industrial valve and piping manufacturing company.

Read the following tender document text and extract ALL available information.

DOCUMENT TEXT:
"""
${contextForMetadata}
"""

SOURCE FILES: ${sourceFileNames.join(', ')}

Extract the following categories of information. For ANY field where the value is NOT found in the document, return null. Never invent or hallucinate values.

Return ONLY a valid JSON object matching this schema:
{
  "tenderDetails": {
    "tenderName": "string or null — Full tender/project name",
    "customer": "string or null — Name of the purchasing/client organization",
    "epcmConsultant": "string or null — EPCM contractor or engineering consultant",
    "projectNo": "string or null — Project number/code",
    "gemTenderNo": "string or null — GeM tender reference number",
    "documentNo": "string or null — Document number",
    "tenderType": "string or null — e.g. Commercial Volume-I, Technical, etc.",
    "date": "string or null — Document date in YYYY-MM-DD format",
    "industry": "string or null — e.g. Oil & Gas, Pipeline, Refinery",
    "procurement": "string or null — What is being procured (e.g. Ball Valves)"
  },
  "projectInformation": {
    "projectName": "string or null — Full project name",
    "pipelines": ["array of pipeline names/codes mentioned"],
    "locations": ["array of location names mentioned"],
    "projectScope": "string or null — Brief scope description"
  },
  "scopeOfSupply": {
    "scopeSummary": "string or null — What needs to be supplied",
    "deliveryTerms": "string or null — FOB/CIF/FOR destination, etc.",
    "inspectionRequirements": "string or null — TPI, stage inspection details",
    "packagingRequirements": "string or null — Packing & forwarding details",
    "installationScope": "string or null — Whether installation/supervision is included"
  },
  "tenderTimeline": {
    "bidSubmissionDate": "string or null — Last date for bid submission (YYYY-MM-DD)",
    "bidOpeningDate": "string or null — Bid opening date (YYYY-MM-DD)",
    "deliveryPeriodDays": "number or null — Delivery period in days",
    "warrantyPeriod": "string or null — e.g. 12 months, 24 months",
    "preDispatchInspection": "boolean or null — Whether PDI is required",
    "startDate": "string or null — Expected project/contract start date",
    "completionDate": "string or null — Expected completion date"
  },
  "commercialTerms": {
    "emdAmount": "number or null — Earnest Money Deposit amount",
    "emdCurrency": "string or null — Currency (INR/USD)",
    "bidValidity": "string or null — e.g. 90 days, 180 days",
    "performanceGuarantee": "string or null — PBG percentage or amount",
    "liquidatedDamages": "string or null — LD clause details",
    "paymentTerms": "string or null — e.g. 30 days from delivery, LC at sight",
    "priceVariationClause": "string or null — PVC applicability",
    "retentionMoney": "string or null — Retention money percentage",
    "securityDeposit": "string or null — SD details"
  },
  "contactPersons": [
    {
      "name": "string",
      "designation": "string or null",
      "email": "string or null",
      "phone": "string or null",
      "department": "string or null"
    }
  ],
  "qualificationCriteria": {
    "turnoverRequirement": "string or null — Minimum annual turnover",
    "experienceYears": "number or null — Minimum years of experience required",
    "similarWorkExperience": "string or null — Similar work order requirement",
    "isoRequirements": "string or null — ISO certifications needed",
    "otherCertifications": ["array of other required certifications"],
    "technicalCapability": "string or null — Manufacturing capability required",
    "financialCapability": "string or null — Financial requirement details"
  },
  "applicableStandards": ["array of standards like API 6D, ASME B16.34, IS 14846, etc."],
  "annexures": [
    {
      "annexureNo": "string — e.g. Annexure-A, Appendix-1",
      "title": "string or null",
      "description": "string or null"
    }
  ],
  "financialTables": [
    {
      "tableName": "string — Name/title of the pricing table",
      "description": "string or null — Brief description"
    }
  ],
  "_confidence": 0-100
}`;

  const validateFn = (data) => data && typeof data === 'object' && data.tenderDetails;

  try {
    const { result } = await callTenderAI({ prompt, validateFn, logTag: 'Tender Intelligence Metadata', enquiryId });
    return result;
  } catch (err) {
    console.error(`[Tender Intelligence] Metadata extraction failed:`, err.message);
    return {
      tenderDetails: {}, projectInformation: {}, scopeOfSupply: {}, tenderTimeline: {},
      commercialTerms: {}, contactPersons: [], qualificationCriteria: {},
      applicableStandards: [], annexures: [], financialTables: [], _confidence: 0
    };
  }
}

/**
 * Pass 2: Extract the full Schedule of Rates (SOR) table
 */
async function extractSORTable(fullTextContext, enquiryId) {
  const SOR_KEYWORDS = [
    'schedule', 'sor', 'schedule of rate', 'sr.no', 'sr no', 'item no',
    'valve', 'ball valve', 'gate valve', 'check valve', 'butterfly valve',
    'size', 'class', 'rating', 'body', 'material', 'quantity', 'qty',
    'nos', 'motorized', 'manual', 'actuator', 'lever operated',
    'a105', 'a216', 'lf2', 'cf8m', 'ss 316', 'ss316', 'cs',
    'socket weld', 'butt weld', 'flanged', 'nptf', 'threaded',
    '150#', '300#', '600#', '800#', '900#', '1500#', '2500#',
    'floating', 'trunnion', 'full bore', 'reduced bore'
  ];

  const maxSORContext = 30000;
  let sorContext = fullTextContext;

  if (fullTextContext.length > maxSORContext) {
    const chunkSize = 4000;
    const overlap = 500;
    const chunks = [];

    for (let i = 0; i < fullTextContext.length; i += (chunkSize - overlap)) {
      const chunk = fullTextContext.substring(i, i + chunkSize);
      const chunkLower = chunk.toLowerCase();
      let score = 0;
      for (const kw of SOR_KEYWORDS) { if (chunkLower.includes(kw)) score += 10; }
      const pipeCount = (chunk.match(/\|/g) || []).length;
      const numberCount = (chunk.match(/\d+/g) || []).length;
      score += Math.min(pipeCount * 2, 50);
      score += Math.min(numberCount, 30);
      chunks.push({ text: chunk, index: i, score });
    }

    chunks.sort((a, b) => b.score - a.score);
    let selectedText = '';
    let currentLen = 0;
    const selected = [];
    for (const chunk of chunks) {
      if (currentLen + chunk.text.length > maxSORContext) break;
      selected.push(chunk);
      currentLen += chunk.text.length;
    }
    selected.sort((a, b) => a.index - b.index);

    let lastEnd = 0;
    for (const chunk of selected) {
      if (chunk.index < lastEnd) {
        const overlapStart = lastEnd - chunk.index;
        selectedText += chunk.text.substring(overlapStart);
      } else {
        if (selectedText.length > 0) selectedText += '\n... [section skipped] ...\n';
        selectedText += chunk.text;
      }
      lastEnd = chunk.index + chunk.text.length;
    }
    sorContext = selectedText;
  }

  const prompt = `You are an expert at extracting Schedule of Rates (SOR) tables from tender documents for industrial valves and piping.

Read the following document text and extract the complete Schedule of Rates table. Each tender typically has multiple Schedules (Sch-1, Sch-2, etc.) and each schedule has multiple line items.

CRITICAL RULES:
- NEVER merge two items that differ in size, body material, end connection, class, or operation type. Even if they have the same description, if any specification differs, they are SEPARATE items.
- Extract EVERY single row from the SOR table. Do not skip or summarize.
- If two items are 1/2" 800# with body A105 and 1/2" 800# with body LF2, they MUST be separate entries.
- Capture the exact quantity for each line item.
- If you see a description like "Body: A105, Ball & Stem: SS 316, full bore, floating ball, lever operated, socket welded / NPTF 800#" — extract each detail.

DOCUMENT TEXT:
"""
${sorContext}
"""

Return ONLY a valid JSON object:
{
  "scheduleOfRates": [
    {
      "scheduleNo": "string — e.g. Schedule-1, Sch-1",
      "scheduleName": "string or null — e.g. CCKPL Pipeline - Manual Valves 150#",
      "items": [
        {
          "srNo": "number or string — Serial number",
          "size": "string — e.g. 1/2\\", 2\\", 4\\"",
          "description": "string — Full item description",
          "bodyMaterial": "string or null — e.g. A105, LF2, A216 WCB",
          "ballStemMaterial": "string or null — e.g. SS 316, SS 304",
          "endConnection": "string or null — e.g. Socket Welded, Flanged, NPTF, Butt Welded",
          "classRating": "string or null — e.g. 150#, 600#, 800#, 900#",
          "operationType": "string or null — e.g. Lever Operated, Gear Operated, Motorized",
          "boreType": "string or null — e.g. Full Bore, Reduced Bore",
          "ballType": "string or null — e.g. Floating Ball, Trunnion Mounted",
          "unit": "string — e.g. Nos., LS",
          "quantity": "number"
        }
      ]
    }
  ],
  "productSummaryBySchedule": [
    {
      "scheduleNo": "string",
      "scheduleName": "string or null",
      "totalItems": "number",
      "totalQuantity": "number",
      "sizeRange": "string — e.g. 1/2\\" to 4\\"",
      "classRange": "string — e.g. 150# to 900#"
    }
  ],
  "_confidence": 0-100
}`;

  const validateFn = (data) => data && typeof data === 'object' && Array.isArray(data.scheduleOfRates);

  try {
    const { result } = await callTenderAI({ prompt, validateFn, logTag: 'Tender Intelligence SOR', enquiryId });
    return result;
  } catch (err) {
    console.error(`[Tender Intelligence] SOR extraction failed:`, err.message);
    return { scheduleOfRates: [], productSummaryBySchedule: [], _confidence: 0 };
  }
}

/**
 * Build a report of missing/unfilled fields
 */
function buildMissingFieldsReport(result) {
  const missing = [];

  const checkField = (section, fieldName, label) => {
    const sectionData = result[section];
    if (!sectionData) {
      missing.push({ section, field: fieldName, label, reason: `Section "${section}" not extracted` });
      return;
    }
    const value = sectionData[fieldName];
    if (value === null || value === undefined || value === '' ||
        (Array.isArray(value) && value.length === 0)) {
      missing.push({ section, field: fieldName, label, reason: 'Not found in document' });
    }
  };

  checkField('tenderDetails', 'tenderName', 'Tender Name');
  checkField('tenderDetails', 'customer', 'Customer');
  checkField('tenderDetails', 'epcmConsultant', 'EPCM Consultant');
  checkField('tenderDetails', 'projectNo', 'Project Number');
  checkField('tenderDetails', 'gemTenderNo', 'GeM Tender Number');
  checkField('tenderDetails', 'documentNo', 'Document Number');
  checkField('tenderDetails', 'date', 'Tender Date');
  checkField('projectInformation', 'projectName', 'Project Name');
  checkField('projectInformation', 'pipelines', 'Pipelines');
  checkField('projectInformation', 'locations', 'Locations');
  checkField('scopeOfSupply', 'scopeSummary', 'Scope Summary');
  checkField('scopeOfSupply', 'deliveryTerms', 'Delivery Terms');
  checkField('tenderTimeline', 'bidSubmissionDate', 'Bid Submission Date');
  checkField('tenderTimeline', 'deliveryPeriodDays', 'Delivery Period');
  checkField('commercialTerms', 'emdAmount', 'EMD Amount');
  checkField('commercialTerms', 'bidValidity', 'Bid Validity');
  checkField('commercialTerms', 'paymentTerms', 'Payment Terms');

  if (!result.contactPersons || result.contactPersons.length === 0) {
    missing.push({ section: 'contactPersons', field: 'contactPersons', label: 'Contact Persons', reason: 'No contacts found in document' });
  }
  if (!result.scheduleOfRates || result.scheduleOfRates.length === 0) {
    missing.push({ section: 'scheduleOfRates', field: 'scheduleOfRates', label: 'Schedule of Rates', reason: 'No SOR table found in document' });
  }
  if (!result.applicableStandards || result.applicableStandards.length === 0) {
    missing.push({ section: 'applicableStandards', field: 'applicableStandards', label: 'Applicable Standards', reason: 'No standards referenced in document' });
  }
  checkField('qualificationCriteria', 'turnoverRequirement', 'Turnover Requirement');
  checkField('qualificationCriteria', 'experienceYears', 'Experience Years');

  return missing;
}

/**
 * Build an empty result structure for when extraction fails or has no context
 */
function buildEmptyResult(sourceFileNames = []) {
  return {
    tenderDetails: {}, projectInformation: {}, scopeOfSupply: {},
    scheduleOfRates: [], productSummaryBySchedule: [],
    tenderTimeline: {}, commercialTerms: {}, contactPersons: [],
    qualificationCriteria: {}, applicableStandards: [], annexures: [],
    financialTables: [],
    metadata: {
      extractedAt: new Date().toISOString(), sourceFiles: sourceFileNames,
      extractionConfidence: 0, totalPasses: 0, textLength: 0
    },
    missingFields: [{ section: 'all', field: 'all', label: 'All Fields', reason: 'Insufficient document text for extraction' }]
  };
}

module.exports = {
  extractTenderIntelligence,
  extractTenderMetadata,
  extractSORTable,
  buildMissingFieldsReport
};

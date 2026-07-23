/**
 * Enquiry Decision Engine
 * 
 * Production-grade multi-stage pipeline that determines whether an incoming email
 * should CREATE a new enquiry or UPDATE an existing one.
 * 
 * Replaces naive threadId/subject matching with weighted similarity scoring,
 * forwarded content isolation, attachment fingerprinting, and audit-trailed decisions.
 * 
 * Stages:
 *   1. Content Isolation — strip quoted/forwarded history, extract fresh vs forwarded blocks
 *   2. Intent Detection — classify email intent (new RFQ, reply, forwarded RFQ, FYI, etc.)
 *   3. Forward Handler — extract forwarded RFQ content independently
 *   4. Weighted Similarity Scoring — 11-dimension comparison with configurable weights
 *   5. Attachment Fingerprinting — SHA256 hash matching
 *   6. AI is extraction-only — business rules decide merge/create
 *   7. Clean Context — no state leakage between jobs
 *   8. Audit Trail — structured decision record for every email
 */

const crypto = require('crypto');
const Enquiry = require('../models/Enquiry');
const Attachment = require('../models/Attachment');
const SystemAuditLog = require('../models/SystemAuditLog');

// ─── Configuration ────────────────────────────────────────────────────────────

const SIMILARITY_THRESHOLD = 75; // Score above this → UPDATE; at or below → CREATE

const SIMILARITY_WEIGHTS = {
  customerDomain:     0.15,
  senderCompany:      0.10,
  rfqNumber:          0.20,
  projectName:        0.10,
  attachmentHash:     0.10,
  lineItemKeywords:   0.10,
  valveTypes:         0.05,
  quantities:         0.05,
  subjectKeywords:    0.05,
  standards:          0.05,
  dateProximity:      0.05
};

// ─── Stage 1: Content Isolation ───────────────────────────────────────────────

/**
 * Forward/reply markers that indicate the boundary between fresh content
 * and quoted/forwarded history.
 */
const FORWARD_MARKERS = [
  /^-{5,}\s*Forwarded message\s*-{5,}/im,
  /^-{3,}\s*Original Message\s*-{3,}/im,
  /^Begin forwarded message:/im,
  /^---------- Forwarded message ----------/im,
  /^\*{3,}\s*Forwarded\s/im,
  /^_{5,}\s*$/m
];

const REPLY_MARKERS = [
  /^On .+wrote:\s*$/im,
  /^On\s+\d{1,2}\s+\w+\s+\d{4}.+wrote:\s*$/im,
  /^>{1,}\s/m,
  /^From:\s*.+\s*$/im  // only when followed by Sent:/Date:
];

/**
 * Stage 1: Isolate fresh email content from quoted/forwarded history.
 * 
 * @param {string} bodyText - Full email body text
 * @param {string} subject  - Email subject line
 * @returns {{ freshContent: string, forwardedContent: string, isForward: boolean, isReply: boolean }}
 */
function isolateEmailContent(bodyText, subject) {
  if (!bodyText) {
    return { freshContent: '', forwardedContent: '', isForward: false, isReply: false };
  }

  const subjectTrimmed = (subject || '').trim();
  const isForward = /^(fwd|fw)\s*:/i.test(subjectTrimmed);
  const isReply = /^re\s*:/i.test(subjectTrimmed) && !isForward;

  // Find the earliest forward marker position
  let forwardSplitIndex = -1;
  for (const marker of FORWARD_MARKERS) {
    const match = bodyText.match(marker);
    if (match) {
      const idx = bodyText.indexOf(match[0]);
      if (forwardSplitIndex === -1 || idx < forwardSplitIndex) {
        forwardSplitIndex = idx;
      }
    }
  }

  let freshContent = bodyText;
  let forwardedContent = '';

  if (forwardSplitIndex !== -1) {
    freshContent = bodyText.substring(0, forwardSplitIndex).trim();
    forwardedContent = bodyText.substring(forwardSplitIndex).trim();

    // Strip the marker line itself from forwarded content to get clean RFQ text
    const lines = forwardedContent.split('\n');
    const cleanedLines = [];
    let pastMarker = false;
    for (const line of lines) {
      if (!pastMarker) {
        // Skip marker lines and forwarded email headers (From:, Date:, Subject:, To:)
        const trimmed = line.trim();
        if (FORWARD_MARKERS.some(m => m.test(trimmed))) continue;
        if (/^(From|Date|Subject|To|Cc|Sent):\s*/i.test(trimmed)) continue;
        if (trimmed === '') continue;
        pastMarker = true;
      }
      if (pastMarker) {
        cleanedLines.push(line);
      }
    }
    forwardedContent = cleanedLines.join('\n').trim();
  } else if (isReply) {
    // For replies without explicit forward markers, strip quoted lines
    const lines = bodyText.split('\n');
    const cleanLines = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^>/.test(trimmed)) break;
      if (/^On .+wrote:\s*$/i.test(trimmed)) break;
      if (/^-{3,}\s*(Original Message)/i.test(trimmed)) break;
      if (/^From:\s*.+$/i.test(trimmed) && lines[lines.indexOf(line) + 1] &&
          /^(Sent|Date):/i.test((lines[lines.indexOf(line) + 1] || '').trim())) break;
      cleanLines.push(line);
    }
    freshContent = cleanLines.join('\n').trim();
  }

  return { freshContent, forwardedContent, isForward, isReply };
}

// ─── Stage 2: Intent Detection ────────────────────────────────────────────────

/**
 * Intent categories for incoming emails.
 */
const EMAIL_INTENTS = [
  'NEW_ENQUIRY',
  'REPLY',
  'FORWARDED_NEW_RFQ',
  'FORWARDED_FYI',
  'QUOTATION',
  'PURCHASE_ORDER',
  'TECHNICAL_CLARIFICATION'
];

/**
 * Valve/product keywords that indicate an RFQ is present.
 */
const RFQ_KEYWORDS = [
  'valve', 'ball valve', 'gate valve', 'globe valve', 'check valve', 'butterfly valve',
  'plug valve', 'needle valve', 'control valve', 'safety valve', 'pressure relief',
  'actuator', 'flange', 'fitting', 'piping', 'vessel', 'tank', 'exchanger',
  'enquiry', 'rfq', 'request for quotation', 'quotation required', 'price required',
  'requirement', 'spec', 'specification', 'datasheet', 'schedule of rates',
  'qty', 'quantity', 'nos', 'numbers', 'size', 'class', 'rating', 'pressure',
  'asme', 'api', 'astm', 'ansi', 'bs', 'din', 'is 14846', 'ibr'
];

/**
 * Stage 2: Detect the intent of an incoming email.
 * 
 * @param {string} subject
 * @param {string} freshContent
 * @param {string} forwardedContent
 * @param {object} classification - AI classification result { category, confidence }
 * @returns {string} One of EMAIL_INTENTS
 */
function detectEmailIntent(subject, freshContent, forwardedContent, classification) {
  const subjectLower = (subject || '').toLowerCase().trim();
  const isForwardSubject = /^(fwd|fw)\s*:/i.test(subjectLower);
  const isReplySubject = /^re\s*:/i.test(subjectLower) && !isForwardSubject;
  const combinedText = `${freshContent} ${forwardedContent}`.toLowerCase();

  // Purchase Order detection
  if (/\b(purchase\s*order|p\.?o\.?\s*no|po\s*number|po\s*#|order\s*confirmation)\b/i.test(combinedText)) {
    return 'PURCHASE_ORDER';
  }

  // Quotation response detection
  if (/\b(our\s*quote|our\s*offer|price\s*list|rate\s*list|budgetary\s*offer|commercial\s*offer)\b/i.test(combinedText) &&
      classification?.category === 'Vendor Document') {
    return 'QUOTATION';
  }

  // Forwarded email handling
  if (isForwardSubject && forwardedContent) {
    const hasRFQContent = RFQ_KEYWORDS.some(kw => forwardedContent.toLowerCase().includes(kw));
    if (hasRFQContent) {
      return 'FORWARDED_NEW_RFQ';
    }
    return 'FORWARDED_FYI';
  }

  // Reply handling
  if (isReplySubject) {
    // Short reply with technical values (e.g. "150#", "ASTM A216 WCB")
    if (freshContent.length < 500 && !RFQ_KEYWORDS.some(kw => freshContent.toLowerCase().includes(kw.length > 5 ? kw : 'NOMATCH'))) {
      return 'TECHNICAL_CLARIFICATION';
    }
    return 'REPLY';
  }

  // Default: new enquiry
  return 'NEW_ENQUIRY';
}

// ─── Stage 3: Forward Handler ─────────────────────────────────────────────────

/**
 * Extract forwarded email metadata (original sender, subject) from forwarded block.
 * 
 * @param {string} fullForwardBlock - The raw forwarded block (including headers)
 * @returns {{ originalSender: string|null, originalSubject: string|null, originalDate: string|null }}
 */
function extractForwardedMetadata(fullForwardBlock) {
  const result = { originalSender: null, originalSubject: null, originalDate: null };
  if (!fullForwardBlock) return result;

  const fromMatch = fullForwardBlock.match(/^From:\s*(.+)$/im);
  if (fromMatch) {
    const emailMatch = fromMatch[1].match(/<?([a-zA-Z0-9._+-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,})>?/);
    result.originalSender = emailMatch ? emailMatch[1].toLowerCase() : fromMatch[1].trim();
  }

  const subjMatch = fullForwardBlock.match(/^Subject:\s*(.+)$/im);
  if (subjMatch) {
    result.originalSubject = subjMatch[1].trim();
  }

  const dateMatch = fullForwardBlock.match(/^(?:Date|Sent):\s*(.+)$/im);
  if (dateMatch) {
    result.originalDate = dateMatch[1].trim();
  }

  return result;
}

// ─── Stage 4: Weighted Similarity Scoring ─────────────────────────────────────

/**
 * Compute Jaccard similarity between two sets of tokens.
 */
function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Fuzzy string similarity (case-insensitive token overlap).
 */
function fuzzySimilarity(strA, strB) {
  if (!strA || !strB) return 0;
  const tokensA = new Set(strA.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(t => t.length > 2));
  const tokensB = new Set(strB.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(t => t.length > 2));
  return jaccardSimilarity(tokensA, tokensB);
}

/**
 * Extract valve type keywords from text.
 */
function extractValveTypes(text) {
  if (!text) return new Set();
  const lower = text.toLowerCase();
  const types = new Set();
  const valveTypes = ['ball', 'gate', 'globe', 'check', 'butterfly', 'plug', 'needle', 'control', 'safety', 'relief', 'shut off', 'isolation'];
  for (const vt of valveTypes) {
    if (lower.includes(vt)) types.add(vt);
  }
  return types;
}

/**
 * Extract standard codes from text.
 */
function extractStandards(text) {
  if (!text) return new Set();
  const lower = text.toLowerCase();
  const standards = new Set();
  const stdPatterns = ['asme', 'api', 'astm', 'ansi', 'bs', 'din', 'is', 'ibr', 'en'];
  for (const std of stdPatterns) {
    const regex = new RegExp(`\\b${std}\\b`, 'i');
    if (regex.test(lower)) standards.add(std.toUpperCase());
  }
  return standards;
}

/**
 * Extract quantities from text.
 */
function extractQuantities(text) {
  if (!text) return [];
  const matches = text.match(/\b(\d+)\s*(?:nos|numbers?|pcs|pieces?|sets?|qty|units?)\b/gi) || [];
  return matches.map(m => {
    const numMatch = m.match(/(\d+)/);
    return numMatch ? parseInt(numMatch[1], 10) : 0;
  }).filter(n => n > 0);
}

/**
 * Extract RFQ/reference numbers from text.
 */
function extractRFQNumbers(text) {
  if (!text) return new Set();
  const patterns = [
    /ENQ-[A-Z0-9-]+/gi,
    /RFQ[-\s]?\w+/gi,
    /QT[-\s]?\w+/gi,
    /PO[-\s]?\w+/gi,
    /REF[-.\s]?\w{2,}-?\d+/gi
  ];
  const refs = new Set();
  for (const pattern of patterns) {
    const matches = text.match(pattern) || [];
    for (const m of matches) refs.add(m.toUpperCase().replace(/\s/g, ''));
  }
  return refs;
}

/**
 * Stage 4: Compute weighted similarity between incoming email data and an existing enquiry.
 * 
 * @param {object} emailData - { senderEmail, senderDomain, subject, bodyContent, attachmentHashes, extractedCompany, extractedProject }
 * @param {object} existingEnquiry - Mongoose Enquiry document (populated)
 * @returns {{ score: number, breakdown: object }}
 */
function computeEnquirySimilarity(emailData, existingEnquiry) {
  const breakdown = {};

  // 1. Customer Domain Match (15%)
  const enquiryEmail = (existingEnquiry.contactEmail || '').toLowerCase();
  const enquiryDomain = enquiryEmail.split('@')[1] || '';
  const senderDomain = (emailData.senderDomain || '').toLowerCase();
  breakdown.customerDomain = (enquiryDomain && senderDomain && enquiryDomain === senderDomain) ? 100 : 0;

  // 2. Sender Company Match (10%)
  const existingCompany = existingEnquiry.senderCompany || existingEnquiry.customer?.companyName || '';
  breakdown.senderCompany = fuzzySimilarity(emailData.extractedCompany || '', existingCompany) * 100;

  // 3. RFQ Number Match (20%)
  const emailRFQs = extractRFQNumbers(`${emailData.subject} ${emailData.bodyContent}`);
  const enquiryRFQs = new Set();
  if (existingEnquiry.enquiryId) enquiryRFQs.add(existingEnquiry.enquiryId.toUpperCase());
  if (existingEnquiry.tenderNumber) enquiryRFQs.add(existingEnquiry.tenderNumber.toUpperCase());
  breakdown.rfqNumber = (emailRFQs.size > 0 && enquiryRFQs.size > 0 && 
    [...emailRFQs].some(r => enquiryRFQs.has(r))) ? 100 : 0;

  // 4. Project Name Match (10%)
  const emailProject = emailData.extractedProject || '';
  const enquiryProject = existingEnquiry.clientName || existingEnquiry.pmcConsultant || '';
  breakdown.projectName = fuzzySimilarity(emailProject, enquiryProject) * 100;

  // 5. Attachment Hash Match (10%)
  const emailHashes = new Set(emailData.attachmentHashes || []);
  const enquiryAttHashes = new Set(emailData.existingAttachmentHashes || []);
  breakdown.attachmentHash = (emailHashes.size > 0 && enquiryAttHashes.size > 0)
    ? jaccardSimilarity(emailHashes, enquiryAttHashes) * 100
    : 0;

  // 6. Line Item Keywords (10%)
  const emailKeywords = new Set(
    (emailData.bodyContent || '').toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(t => t.length > 3 && RFQ_KEYWORDS.some(kw => kw.includes(t) || t.includes(kw)))
  );
  const enquiryKeywords = new Set(
    (existingEnquiry.productDescription || '').toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(t => t.length > 3)
  );
  breakdown.lineItemKeywords = jaccardSimilarity(emailKeywords, enquiryKeywords) * 100;

  // 7. Valve Types (5%)
  const emailValves = extractValveTypes(emailData.bodyContent);
  const enquiryValves = extractValveTypes(existingEnquiry.productDescription);
  breakdown.valveTypes = jaccardSimilarity(emailValves, enquiryValves) * 100;

  // 8. Quantities (5%)
  const emailQtys = extractQuantities(emailData.bodyContent);
  const enquiryQtys = existingEnquiry.products?.map(p => p.quantity) || [existingEnquiry.quantity];
  const validEnquiryQtys = enquiryQtys.filter(q => q && q > 0);
  if (emailQtys.length > 0 && validEnquiryQtys.length > 0) {
    const matchCount = emailQtys.filter(eq => validEnquiryQtys.includes(eq)).length;
    breakdown.quantities = (matchCount / Math.max(emailQtys.length, validEnquiryQtys.length)) * 100;
  } else {
    breakdown.quantities = 0;
  }

  // 9. Subject Keywords (5%)
  const emailSubjTokens = new Set(
    (emailData.subject || '').toLowerCase().replace(/^(re|fwd|fw)\s*:\s*/i, '')
      .replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(t => t.length > 2)
  );
  const enquiryDescTokens = new Set(
    (existingEnquiry.productDescription || '').toLowerCase()
      .replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(t => t.length > 2)
  );
  breakdown.subjectKeywords = jaccardSimilarity(emailSubjTokens, enquiryDescTokens) * 100;

  // 10. Standards (5%)
  const emailStds = extractStandards(emailData.bodyContent);
  const enquiryStds = extractStandards(existingEnquiry.productDescription + ' ' + (existingEnquiry.standardCode || ''));
  breakdown.standards = jaccardSimilarity(emailStds, enquiryStds) * 100;

  // 11. Date Proximity (5%) — within 30 days
  const emailDate = emailData.receivedAt ? new Date(emailData.receivedAt) : new Date();
  const enquiryDate = existingEnquiry.createdAt ? new Date(existingEnquiry.createdAt) : new Date();
  const daysDiff = Math.abs((emailDate - enquiryDate) / (1000 * 60 * 60 * 24));
  breakdown.dateProximity = daysDiff <= 30 ? Math.max(0, 100 - (daysDiff * 3.33)) : 0;

  // Compute weighted score
  let score = 0;
  score += breakdown.customerDomain * SIMILARITY_WEIGHTS.customerDomain;
  score += breakdown.senderCompany * SIMILARITY_WEIGHTS.senderCompany;
  score += breakdown.rfqNumber * SIMILARITY_WEIGHTS.rfqNumber;
  score += breakdown.projectName * SIMILARITY_WEIGHTS.projectName;
  score += breakdown.attachmentHash * SIMILARITY_WEIGHTS.attachmentHash;
  score += breakdown.lineItemKeywords * SIMILARITY_WEIGHTS.lineItemKeywords;
  score += breakdown.valveTypes * SIMILARITY_WEIGHTS.valveTypes;
  score += breakdown.quantities * SIMILARITY_WEIGHTS.quantities;
  score += breakdown.subjectKeywords * SIMILARITY_WEIGHTS.subjectKeywords;
  score += breakdown.standards * SIMILARITY_WEIGHTS.standards;
  score += breakdown.dateProximity * SIMILARITY_WEIGHTS.dateProximity;

  return { score: Math.round(score), breakdown };
}

// ─── Stage 5: Attachment Fingerprinting ───────────────────────────────────────

/**
 * Compute SHA256 hash for a file buffer.
 */
function computeSHA256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ─── Stage 8: Audit Trail ─────────────────────────────────────────────────────

/**
 * Build a structured audit trail record for an enquiry decision.
 */
function buildAuditTrail({ decision, reason, similarityScore, intent, matches, threshold, candidateEnquiryIds, emailMessageId }) {
  return {
    decision,
    reason,
    similarityScore: similarityScore || 0,
    emailIntent: intent,
    threshold: threshold || SIMILARITY_THRESHOLD,
    matches: matches || {},
    candidateEnquiries: candidateEnquiryIds || [],
    emailMessageId,
    timestamp: new Date().toISOString()
  };
}

/**
 * Persist an audit trail record to SystemAuditLog.
 */
async function logEnquiryDecision(auditTrail, emailMessageId) {
  try {
    await SystemAuditLog.create({
      eventType: 'ENQUIRY_DECISION',
      entityType: 'EmailMessage',
      entityId: emailMessageId,
      action: `${auditTrail.decision}: ${auditTrail.reason}`,
      metadata: auditTrail
    });
  } catch (err) {
    console.error('[Decision Engine] Failed to log audit trail:', err.message);
  }
}

// ─── Master Orchestrator ──────────────────────────────────────────────────────

/**
 * Master decision function. Determines CREATE vs UPDATE for an incoming email.
 * 
 * @param {object} emailMsg       - EmailMessage mongoose document
 * @param {object} customer       - Customer mongoose document
 * @param {object} classification - AI classification result { category, confidence, ... }
 * @param {Array}  candidateEnquiries - Array of Enquiry documents that could potentially match
 * @returns {Promise<{ decision: string, reason: string, similarityScore: number, matchedEnquiryId: string|null, auditTrail: object, intent: string, bodyTextForExtraction: string }>}
 */
async function makeEnquiryDecision(emailMsg, customer, classification, candidateEnquiries = []) {
  const subject = emailMsg.subject || '';
  const bodyText = emailMsg.bodyText || '';

  // ── Stage 1: Content Isolation ──
  const isolated = isolateEmailContent(bodyText, subject);
  console.log(`[Decision Engine] Stage 1 — Content isolation: isForward=${isolated.isForward}, isReply=${isolated.isReply}, freshLen=${isolated.freshContent.length}, forwardedLen=${isolated.forwardedContent.length}`);

  // ── Stage 2: Intent Detection ──
  const intent = detectEmailIntent(subject, isolated.freshContent, isolated.forwardedContent, classification);
  console.log(`[Decision Engine] Stage 2 — Intent: ${intent}`);

  // Determine what text to use for AI extraction
  let bodyTextForExtraction;
  if (intent === 'FORWARDED_NEW_RFQ') {
    // Use the forwarded RFQ content as the primary text for extraction
    bodyTextForExtraction = isolated.forwardedContent || bodyText;
  } else if (isolated.isReply) {
    bodyTextForExtraction = isolated.freshContent || bodyText;
  } else {
    bodyTextForExtraction = bodyText;
  }

  // ── Fast paths ──

  // New enquiry with no forward/reply prefix → always CREATE
  if (intent === 'NEW_ENQUIRY') {
    const auditTrail = buildAuditTrail({
      decision: 'CREATE',
      reason: 'Fresh email with no RE:/FW: prefix — always create new enquiry',
      intent,
      emailMessageId: emailMsg._id
    });
    await logEnquiryDecision(auditTrail, emailMsg._id);
    return { decision: 'CREATE', reason: auditTrail.reason, similarityScore: 0, matchedEnquiryId: null, auditTrail, intent, bodyTextForExtraction };
  }

  // Forwarded FYI (no product content) → skip enquiry creation
  if (intent === 'FORWARDED_FYI') {
    const auditTrail = buildAuditTrail({
      decision: 'SKIP',
      reason: 'Forwarded email is informational (no RFQ/product content detected)',
      intent,
      emailMessageId: emailMsg._id
    });
    await logEnquiryDecision(auditTrail, emailMsg._id);
    return { decision: 'SKIP', reason: auditTrail.reason, similarityScore: 0, matchedEnquiryId: null, auditTrail, intent, bodyTextForExtraction };
  }

  // Purchase Order → route separately
  if (intent === 'PURCHASE_ORDER') {
    const auditTrail = buildAuditTrail({
      decision: 'SKIP',
      reason: 'Email contains Purchase Order reference — not an RFQ',
      intent,
      emailMessageId: emailMsg._id
    });
    await logEnquiryDecision(auditTrail, emailMsg._id);
    return { decision: 'SKIP', reason: auditTrail.reason, similarityScore: 0, matchedEnquiryId: null, auditTrail, intent, bodyTextForExtraction };
  }

  // ── Stage 3 + 4: Compare against candidate enquiries ──

  // If no candidates to compare against → CREATE
  if (!candidateEnquiries || candidateEnquiries.length === 0) {
    const auditTrail = buildAuditTrail({
      decision: 'CREATE',
      reason: 'No existing enquiries found for comparison — creating new enquiry',
      intent,
      emailMessageId: emailMsg._id
    });
    await logEnquiryDecision(auditTrail, emailMsg._id);
    return { decision: 'CREATE', reason: auditTrail.reason, similarityScore: 0, matchedEnquiryId: null, auditTrail, intent, bodyTextForExtraction };
  }

  // ── Stage 5: Gather attachment hashes for this email ──
  const emailAttachments = await Attachment.find({ _id: { $in: emailMsg.attachments || [] } });
  const emailAttHashes = emailAttachments.map(a => a.contentHash).filter(Boolean);

  // Build email data for similarity comparison
  const senderDomain = (emailMsg.sender || '').split('@')[1] || '';
  const emailData = {
    senderEmail: emailMsg.sender,
    senderDomain,
    subject: emailMsg.subject,
    bodyContent: bodyTextForExtraction,
    attachmentHashes: emailAttHashes,
    extractedCompany: customer?.companyName || '',
    extractedProject: '',
    receivedAt: emailMsg.receivedAt,
    existingAttachmentHashes: [] // Will be populated per-enquiry
  };

  // Score each candidate enquiry
  let bestScore = 0;
  let bestMatch = null;
  let bestBreakdown = {};

  for (const candidateEnq of candidateEnquiries) {
    // Get existing attachment hashes for this enquiry
    const existingAtts = await Attachment.find({
      _id: { $in: candidateEnq.attachmentsList || [] }
    });
    emailData.existingAttachmentHashes = existingAtts.map(a => a.contentHash).filter(Boolean);

    const { score, breakdown } = computeEnquirySimilarity(emailData, candidateEnq);

    console.log(`[Decision Engine] Stage 4 — Similarity with ${candidateEnq.enquiryId}: ${score}% [${Object.entries(breakdown).map(([k,v]) => `${k}=${Math.round(v)}`).join(', ')}]`);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidateEnq;
      bestBreakdown = breakdown;
    }
  }

  // ── Decision based on intent and score ──

  const candidateIds = candidateEnquiries.map(e => e.enquiryId);
  const matchDetails = {
    threadMatch: !!(emailMsg.threadId && bestMatch?.threadId === emailMsg.threadId),
    customerMatch: bestBreakdown.customerDomain > 0,
    rfqNumberMatch: bestBreakdown.rfqNumber > 0,
    attachmentMatch: bestBreakdown.attachmentHash > 0,
    lineItemMatch: bestBreakdown.lineItemKeywords > 30,
    projectMatch: bestBreakdown.projectName > 30
  };

  if (intent === 'FORWARDED_NEW_RFQ') {
    // Forwarded RFQs require HIGHER confidence to merge, OR an explicit RFQ number match
    if (bestScore > SIMILARITY_THRESHOLD || matchDetails.rfqNumberMatch) {
      const auditTrail = buildAuditTrail({
        decision: 'UPDATE',
        reason: `Forwarded RFQ matches existing enquiry ${bestMatch.enquiryId} with ${bestScore}% similarity (${matchDetails.rfqNumberMatch ? 'explicit RFQ number match' : `above ${SIMILARITY_THRESHOLD}% threshold`})`,
        similarityScore: bestScore,
        intent,
        matches: matchDetails,
        candidateEnquiryIds: candidateIds,
        emailMessageId: emailMsg._id
      });
      await logEnquiryDecision(auditTrail, emailMsg._id);
      return { decision: 'UPDATE', reason: auditTrail.reason, similarityScore: bestScore, matchedEnquiryId: bestMatch._id, auditTrail, intent, bodyTextForExtraction };
    } else {
      const auditTrail = buildAuditTrail({
        decision: 'CREATE',
        reason: `Forwarded RFQ is a different enquiry from ${candidateIds.join(', ')} (similarity: ${bestScore}% ≤ ${SIMILARITY_THRESHOLD}% threshold)`,
        similarityScore: bestScore,
        intent,
        matches: matchDetails,
        candidateEnquiryIds: candidateIds,
        emailMessageId: emailMsg._id
      });
      await logEnquiryDecision(auditTrail, emailMsg._id);
      return { decision: 'CREATE', reason: auditTrail.reason, similarityScore: bestScore, matchedEnquiryId: null, auditTrail, intent, bodyTextForExtraction };
    }
  }

  if (intent === 'REPLY' || intent === 'TECHNICAL_CLARIFICATION') {
    // Replies match with lower threshold — RFQ number match alone is enough
    if (bestScore > 40 || matchDetails.rfqNumberMatch) {
      const auditTrail = buildAuditTrail({
        decision: 'UPDATE',
        reason: `Reply matches existing enquiry ${bestMatch.enquiryId} with ${bestScore}% similarity`,
        similarityScore: bestScore,
        intent,
        matches: matchDetails,
        candidateEnquiryIds: candidateIds,
        emailMessageId: emailMsg._id
      });
      await logEnquiryDecision(auditTrail, emailMsg._id);
      return { decision: 'UPDATE', reason: auditTrail.reason, similarityScore: bestScore, matchedEnquiryId: bestMatch._id, auditTrail, intent, bodyTextForExtraction };
    }
  }

  // Default: CREATE new enquiry
  const auditTrail = buildAuditTrail({
    decision: 'CREATE',
    reason: `No sufficiently similar existing enquiry found (best score: ${bestScore}%)`,
    similarityScore: bestScore,
    intent,
    matches: matchDetails,
    candidateEnquiryIds: candidateIds,
    emailMessageId: emailMsg._id
  });
  await logEnquiryDecision(auditTrail, emailMsg._id);
  return { decision: 'CREATE', reason: auditTrail.reason, similarityScore: bestScore, matchedEnquiryId: null, auditTrail, intent, bodyTextForExtraction };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Stage 1
  isolateEmailContent,
  // Stage 2
  detectEmailIntent,
  EMAIL_INTENTS,
  // Stage 3
  extractForwardedMetadata,
  // Stage 4
  computeEnquirySimilarity,
  SIMILARITY_THRESHOLD,
  SIMILARITY_WEIGHTS,
  // Stage 5
  computeSHA256,
  // Stage 8
  buildAuditTrail,
  logEnquiryDecision,
  // Master
  makeEnquiryDecision,
  // Helpers (exported for testing)
  jaccardSimilarity,
  fuzzySimilarity,
  extractValveTypes,
  extractStandards,
  extractQuantities,
  extractRFQNumbers
};

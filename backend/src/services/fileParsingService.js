const XLSX = require('xlsx');
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');
const crypto = require('crypto');
const Attachment = require('../models/Attachment');
const { uploadFile } = require('./localStorageService');

// pdf-parse v2 exports an object with PDFParse class — cache it at module load
let _PDFParse = null;
try {
  const pdfParseModule = require('pdf-parse');
  if (pdfParseModule && typeof pdfParseModule.PDFParse === 'function') {
    _PDFParse = pdfParseModule.PDFParse;
    console.log('[File Parsing] pdf-parse loaded: PDFParse class (v2.x)');
  } else {
    _PDFParse = null;
    console.warn('[File Parsing] pdf-parse: unexpected export shape, will use fallback');
  }
} catch (e) {
  console.error('[File Parsing] Failed to load pdf-parse:', e.message);
}

/**
 * Clean OCR or document text to remove headers, footers, duplicate lines, and normalize whitespace
 * Part 16: OCR Improvements
 */
function cleanOcrText(text) {
  if (!text) return '';

  // 1. Split into lines
  let lines = text.split(/\r?\n/);

  // 2. Remove standard page headers/footers and metadata lines
  const footerHeaderRegexes = [
    /^\s*page\s+\d+\s+of\s+\d+\s*$/i,
    /^\s*page\s+\d+\s*$/i,
    /^\s*confidential\s*$/i,
    /^\s*all rights reserved\s*$/i,
    /^\s*petro\s*valve\s*industries\s*$/i,
    /^\s*www\.[a-z0-9-]+\.[a-z]{2,}\s*$/i // website footers
  ];

  lines = lines.filter(line => {
    const cleanLine = line.trim();
    if (!cleanLine) return true; // Keep empty lines for structural separation
    return !footerHeaderRegexes.some(rx => rx.test(cleanLine));
  });

  // 3. Normalize whitespace (Part 16)
  lines = lines.map(line => line.replace(/\s+/g, ' ').trim());

  // 4. Merge broken hyphenated words (Part 16)
  const mergedLines = [];
  for (let i = 0; i < lines.length; i++) {
    let currentLine = lines[i];
    if (currentLine.endsWith('-') && i + 1 < lines.length) {
      currentLine = currentLine.slice(0, -1) + lines[i + 1];
      i++; // skip next line
    }
    mergedLines.push(currentLine);
  }

  // 5. Deduplicate consecutive duplicate adjacent lines
  const uniqueLines = [];
  for (const line of mergedLines) {
    if (line === '') {
      if (uniqueLines[uniqueLines.length - 1] !== '') {
        uniqueLines.push('');
      }
    } else {
      if (uniqueLines.length === 0 || uniqueLines[uniqueLines.length - 1] !== line) {
        uniqueLines.push(line);
      }
    }
  }

  return uniqueLines.join('\n').trim();
}

/**
 * Detects the category of an attachment based on its filename and extension.
 */
function detectCategory(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const name = fileName.toLowerCase();

  // CAD & Drawings
  if (['dwg', 'dxf', 'step', 'stp', 'iges', 'igs'].includes(ext) || name.includes('drawing') || name.includes('cad')) {
    return 'Drawing';
  }

  // Datasheets / Specifications
  if (['pdf', 'docx', 'doc', 'txt'].includes(ext) || name.includes('datasheet') || name.includes('spec')) {
    return 'Datasheet';
  }

  // Commercial / Quotations
  if (['xlsx', 'xls', 'csv'].includes(ext) || name.includes('commercial') || name.includes('quote') || name.includes('price')) {
    return 'Commercial';
  }

  return 'Unknown';
}

/**
 * Checks if a file extension is a supported CAD or engineering drawing format.
 */
function isCADFile(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  return ['dwg', 'dxf', 'step', 'stp', 'iges', 'igs', 'zip'].includes(ext);
}

/**
 * Extract text content from supported file types (PDF, XLSX, DOCX, PNG, JPG, etc.)
 * Returns { text, confidence, status, category }
 */
async function extractTextFromFile(buffer, fileType, fileName) {
  const category = detectCategory(fileName);

  // Part 17: Hash-based OCR Caching
  const fileHash = crypto.createHash('md5').update(buffer).digest('hex');
  const aiConfig = require('../config/aiConfig');

  if (aiConfig.OCR_CACHE_ENABLED) {
    const cached = await Attachment.findOne({ fileHash, extractionStatus: 'SUCCESS' });
    if (cached && cached.extractedText) {
      console.log(`[File Parsing] OCR Cache Hit for hash ${fileHash} (file: ${fileName}). Reusing extracted text.`);
      return {
        text: cached.extractedText,
        confidence: (cached.ocrConfidence !== undefined && cached.ocrConfidence !== null) ? cached.ocrConfidence : 0,
        status: 'SUCCESS',
        category: cached.attachmentCategory || category
      };
    }
  }

  if (isCADFile(fileName)) {
    console.log(`[File Parsing] CAD/Drawing file detected (${fileName}). Skipping text extraction.`);
    return {
      text: '',
      confidence: 0,
      status: 'NOT_SUPPORTED',
      category: 'Drawing'
    };
  }

  const ext = fileName.split('.').pop().toLowerCase();
  let resultObj = { text: '', confidence: 0, status: 'FAILED', category };

  try {
    // 1. PDF Documents
    if (ext === 'pdf' || fileType === 'application/pdf') {
      console.log(`[File Parsing] Extracting text from PDF: ${fileName} (buffer size: ${buffer.length})`);
      
      let pdfTextResult = '';
      if (_PDFParse) {
        try {
          const parser = new _PDFParse({ data: buffer });
          await parser.load();
          const result = await parser.getText();
          pdfTextResult = (result.text || '').trim();
          console.log(`[File Parsing] PDF text extracted via PDFParse class: ${pdfTextResult.length} chars from ${fileName}`);

          const isCleanText = pdfTextResult.length >= 250 || (buffer.length < 30000 && pdfTextResult.length >= 80);
          if (isCleanText) {
            resultObj = { text: pdfTextResult, confidence: 100, status: 'SUCCESS', category };
          } else {
            console.log(`[File Parsing] PDF has very little text (${pdfTextResult.length} chars for ${buffer.length} bytes) — likely scanned: ${fileName}. Trying AI Vision OCR...`);
          }
        } catch (pdfErr) {
          console.error(`[File Parsing] PDFParse class failed for ${fileName}: ${pdfErr.message}`);
        }
      }

      // If PDFParse failed or returned too little text, run Gemini Vision OCR
      if (resultObj.status !== 'SUCCESS' && process.env.GEMINI_API_KEY) {
        console.log(`[File Parsing] Using Gemini Vision API to OCR scanned PDF: ${fileName}`);
        try {
          const base64Pdf = buffer.toString('base64');
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
          const geminiPayload = {
            contents: [{
              parts: [
                {
                  inlineData: {
                    mimeType: 'application/pdf',
                    data: base64Pdf
                  }
                },
                {
                  text: `Extract ALL text content from this scanned PDF document. This is a Request for Quotation (RFQ) or product specification document for industrial valves/piping. Return the COMPLETE text content exactly as it appears in the document. Return ONLY the extracted text content. Do not add any commentary or formatting instructions.`
                }
              ]
            }]
          };

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 45000);
          const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (geminiRes.ok) {
            const geminiResult = await geminiRes.json();
            const extractedText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const trimmed = extractedText.trim();
            
            if (trimmed.length > 20) {
              console.log(`[File Parsing] ✅ Gemini Vision OCR extracted ${trimmed.length} chars from scanned PDF: ${fileName}`);
              resultObj = { text: trimmed, confidence: 90, status: 'SUCCESS', category };
            }
          } else {
            console.warn(`[File Parsing] Gemini Vision OCR returned ${geminiRes.status} for ${fileName}`);
          }
        } catch (geminiErr) {
          console.error(`[File Parsing] Gemini Vision OCR failed for ${fileName}:`, geminiErr.message);
        }
      }

      // Graceful fallback to whatever text was extracted by PDFParse
      if (resultObj.status !== 'SUCCESS' && pdfTextResult && pdfTextResult.length > 0) {
        resultObj = {
          text: pdfTextResult,
          confidence: pdfTextResult.length > 50 ? 80 : 40,
          status: 'SUCCESS',
          category
        };
      }
    }

    // 2. Excel Spreadsheets / CSV
    else if (['xlsx', 'xls', 'csv'].includes(ext) || fileType.includes('spreadsheet') || fileType.includes('csv')) {
      console.log(`[File Parsing] Extracting text from Excel/CSV: ${fileName}`);
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let text = '';

      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        text += `\n--- Sheet: ${sheetName} ---\n`;
        text += XLSX.utils.sheet_to_txt(sheet) + '\n';
      });

      resultObj = {
        text: text.trim(),
        confidence: 100,
        status: 'SUCCESS',
        category
      };
    }

    // 3. Word Documents
    else if (ext === 'docx' || fileType.includes('word')) {
      console.log(`[File Parsing] Extracting text from Word: ${fileName}`);
      const result = await mammoth.extractRawText({ buffer });
      resultObj = {
        text: (result.value || '').trim(),
        confidence: 100,
        status: 'SUCCESS',
        category
      };
    }

    // 4. Images (OCR via Gemini Vision → Tesseract.js fallback)
    else if (['png', 'jpg', 'jpeg', 'tiff', 'tif'].includes(ext) || fileType.startsWith('image/')) {
      if (process.env.GEMINI_API_KEY) {
        console.log(`[File Parsing] Running Gemini Vision OCR on image: ${fileName}`);
        try {
          const base64Img = buffer.toString('base64');
          const mimeType = fileType.startsWith('image/') ? fileType : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
          const geminiPayload = {
            contents: [{
              parts: [
                { inlineData: { mimeType, data: base64Img } },
                { text: `Extract ALL text content from this image. This may be a product specification sheet, RFQ, or technical document for industrial valves/piping. Return the COMPLETE text content exactly as it appears. Return ONLY the extracted text.` }
              ]
            }]
          };

          const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
          });

          if (geminiRes.ok) {
            const geminiResult = await geminiRes.json();
            const extractedText = (geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
            if (extractedText.length > 10) {
              console.log(`[File Parsing] ✅ Gemini Vision OCR extracted ${extractedText.length} chars from image: ${fileName}`);
              resultObj = { text: extractedText, confidence: 90, status: 'SUCCESS', category };
            }
          }
        } catch (geminiErr) {
          console.error(`[File Parsing] Gemini Vision OCR failed for image ${fileName}:`, geminiErr.message);
        }
      }

      if (resultObj.status !== 'SUCCESS') {
        console.log(`[File Parsing] Running Tesseract OCR on image: ${fileName}`);
        const { data: { text, confidence } } = await Tesseract.recognize(buffer, 'eng');
        resultObj = {
          text: (text || '').trim(),
          confidence: confidence || 70,
          status: 'SUCCESS',
          category
        };
      }
    }
  } catch (err) {
    console.error(`[File Parsing] UNHANDLED ERROR extracting text from ${fileName}:`, err.message);
  }

  // Part 16: Clean the extracted OCR text to remove headers, footers, whitespace normalization
  if (resultObj.status === 'SUCCESS' && resultObj.text) {
    resultObj.text = cleanOcrText(resultObj.text);
  }

  return resultObj;
}

/**
 * Saves file to local storage and creates/versions an Attachment record in the database.
 */
async function saveAndVersionAttachment({
  fileBuffer,
  originalFileName,
  fileType,
  fileSize,
  customerId,
  threadId,
  originalMessageId,
  uploadedBy = null,
  attachmentOwnerType = 'Customer'
}) {
  try {
    // 1. Upload original file to local storage
    console.log(`[Attachment Storage] Saving ${originalFileName} to local storage...`);
    const storagePath = await uploadFile(fileBuffer, originalFileName, fileType);

    // Calculate file MD5 hash for cache keys
    const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');

    // 2. Extract text/OCR content
    const extractionResult = await extractTextFromFile(fileBuffer, fileType, originalFileName);

    // 3. Resolve version control
    const existing = await Attachment.findOne({
      customerId,
      threadId,
      originalFileName,
      parentAttachmentId: null
    });

    let versionNumber = 1;
    let parentAttachmentId = null;

    if (existing) {
      const latestVersion = await Attachment.findOne({
        $or: [
          { _id: existing._id },
          { parentAttachmentId: existing._id }
        ]
      }).sort({ versionNumber: -1 });

      versionNumber = (latestVersion ? latestVersion.versionNumber : 1) + 1;
      parentAttachmentId = existing._id;

      await Attachment.updateMany(
        {
          $or: [
            { _id: existing._id },
            { parentAttachmentId: existing._id }
          ]
        },
        { $set: { isLatestVersion: false } }
      );
      
      console.log(`[Attachment Versioning] Creating version ${versionNumber} for file: ${originalFileName}`);
    }

    // Run document classification (Phase 1)
    const classificationResult = await classifyAttachment(originalFileName, extractionResult.text || '');

    // 4. Create the new Attachment record
    const attachment = await Attachment.create({
      customerId,
      threadId,
      originalMessageId,
      originalFileName,
      fileType,
      fileSize,
      storagePath,
      fileHash,
      extractedText: extractionResult.text,
      extractionStatus: extractionResult.status,
      ocrConfidence: extractionResult.ocrConfidence || extractionResult.confidence,
      attachmentCategory: classificationResult.category,
      classification: classificationResult,
      versionNumber,
      parentAttachmentId,
      isLatestVersion: true,
      attachmentOwnerType,
      uploadedBy,
      uploadedAt: new Date()
    });

    console.log(`[Attachment Storage] Saved Attachment record in DB: ${attachment._id}`);
    return attachment;
  } catch (err) {
    console.error(`[Attachment Storage] Error in saveAndVersionAttachment:`, err.message);
    throw err;
  }
}

/**
 * Local heuristics for document classification (filename + text keywords).
 * Part of Phase 1.
 */
function runLocalHeuristics(fileName, textSnippet = '') {
  const name = fileName.toLowerCase();
  const text = textSnippet.toLowerCase();

  // 1. Direct Extension / Filename Heuristics (Unambiguous)
  if (['dwg', 'dxf', 'step', 'stp', 'iges', 'igs'].some(ext => name.endsWith('.' + ext)) || name.includes('drawing') || name.includes('isometric') || name.includes('ga-drg')) {
    return { category: 'Drawing', confidence: 100, source: 'heuristic' };
  }
  if (name.includes('priced boq') || name.includes('price bid') || name.includes('price_bid') || name.includes('financial bid')) {
    return { category: 'Price Bid', confidence: 100, source: 'heuristic' };
  }
  if (name.includes('boq') || name.includes('bill of quantit') || name.includes('schedule of rate') || name.includes('price schedule') || name.includes('sor.xls') || name.includes('sor_')) {
    return { category: 'BOQ', confidence: 100, source: 'heuristic' };
  }
  if (name.includes('corrigendum') || name.includes('amendment') || name.includes('addendum') || name.includes('extension')) {
    return { category: 'Corrigendum', confidence: 100, source: 'heuristic' };
  }
  if (name.includes('datasheet') || name.includes('data sheet') || name.includes('technical data')) {
    return { category: 'Datasheet', confidence: 95, source: 'heuristic' };
  }
  if (name.includes('inspection') || name.includes('release note') || name.includes('mtc') || name.includes('test certificate') || name.includes('mill certificate')) {
    return { category: 'Inspection Document', confidence: 95, source: 'heuristic' };
  }
  if (name.includes('purchase order') || name.includes('po_') || name.includes('po-')) {
    return { category: 'Purchase Order', confidence: 95, source: 'heuristic' };
  }
  if (name.includes('qap') || name.includes('quality plan') || name.includes('quality assurance')) {
    return { category: 'Quality Plan', confidence: 95, source: 'heuristic' };
  }
  if (name.includes('pre-bid query') || name.includes('prebid') || name.includes('query reply') || name.includes('vendor query')) {
    return { category: 'Vendor Query', confidence: 95, source: 'heuristic' };
  }
  if (name.includes('annexure') || name.includes('appendix') || name.includes('exhibit')) {
    return { category: 'Annexure', confidence: 90, source: 'heuristic' };
  }
  if (name.includes('nit') || name.includes('notice inviting') || name.includes('tender document') || name.includes('general tender')) {
    return { category: 'General Tender', confidence: 90, source: 'heuristic' };
  }

  // 2. Text Keyword Heuristics
  if (text.includes('bill of quantities') || text.includes('schedule of rates') || (text.includes('item no') && text.includes('qty') && text.includes('description'))) {
    return { category: 'BOQ', confidence: 90, source: 'heuristic' };
  }
  if (text.includes('technical specification') || text.includes('specification sheet') || text.includes('scope of work')) {
    return { category: 'Technical Specification', confidence: 90, source: 'heuristic' };
  }

  // Ambiguous: return low confidence to force AI classifier
  return { category: 'Unknown', confidence: 0, source: 'heuristic' };
}

/**
 * Integrates local heuristics and AI classifier fallback.
 * Part of Phase 1.
 */
async function classifyAttachment(fileName, textContent = '') {
  const textSnippet = textContent.substring(0, 2000);
  
  // 1. Local Heuristics
  const localResult = runLocalHeuristics(fileName, textSnippet);
  
  if (localResult.confidence >= 90) {
    console.log(`[Attachment Classification]\nFile: ${fileName}\nMethod: Heuristic\nCategory: ${localResult.category}\nConfidence: ${localResult.confidence}%\n`);
    return localResult;
  }

  // 2. AI Classifier Fallback
  console.log(`[Attachment Classification] Ambiguous document "${fileName}" (heuristic confidence: ${localResult.confidence}%). Invoking AI...`);
  const aiService = require('./aiService');
  const aiResult = await aiService.classifyAttachmentAgent(fileName, textSnippet);

  console.log(`[Attachment Classification]\nFile: ${fileName}\nMethod: AI\nCategory: ${aiResult.category}\nConfidence: ${aiResult.confidence}%\n`);
  
  return {
    category: aiResult.category,
    confidence: aiResult.confidence,
    source: 'ai'
  };
}

module.exports = {
  extractTextFromFile,
  saveAndVersionAttachment,
  detectCategory,
  classifyAttachment
};

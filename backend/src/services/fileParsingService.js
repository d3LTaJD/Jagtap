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
  // v2.x exports: { PDFParse, ... }
  if (pdfParseModule && typeof pdfParseModule.PDFParse === 'function') {
    _PDFParse = pdfParseModule.PDFParse;
    console.log('[File Parsing] pdf-parse loaded: PDFParse class (v2.x)');
  } else {
    // Fallback: older versions exported the function directly
    _PDFParse = null;
    console.warn('[File Parsing] pdf-parse: unexpected export shape, will use fallback');
  }
} catch (e) {
  console.error('[File Parsing] Failed to load pdf-parse:', e.message);
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

  if (isCADFile(fileName)) {
    console.log(`[File Parsing] CAD/Drawing file detected (${fileName}). Skipping text extraction.`);
    return {
      text: '',
      confidence: 100, // CAD files don't need OCR, treated as high confidence unparsed assets
      status: 'NOT_SUPPORTED',
      category: 'Drawing'
    };
  }

  const ext = fileName.split('.').pop().toLowerCase();

  try {
    // 1. PDF Documents
    if (ext === 'pdf' || fileType === 'application/pdf') {
      console.log(`[File Parsing] Extracting text from PDF: ${fileName} (buffer size: ${buffer.length})`);
      
      // Attempt 1: Use PDFParse class (pdf-parse v2.x)
      let pdfTextResult = '';
      if (_PDFParse) {
        try {
          const parser = new _PDFParse({ data: buffer });
          await parser.load();
          const result = await parser.getText();
          pdfTextResult = (result.text || '').trim();
          console.log(`[File Parsing] PDF text extracted via PDFParse class: ${pdfTextResult.length} chars from ${fileName}`);

          if (pdfTextResult.length >= 50) {
            return { text: pdfTextResult, confidence: 100, status: 'SUCCESS', category };
          }
          
          console.log(`[File Parsing] PDF has very little text (${pdfTextResult.length} chars) — likely scanned: ${fileName}. Trying AI Vision OCR...`);
        } catch (pdfErr) {
          console.error(`[File Parsing] PDFParse class failed for ${fileName}: ${pdfErr.message}`);
          console.error('[File Parsing] Stack:', pdfErr.stack);
          // Fall through to AI Vision / Tesseract OCR fallback below
        }
      }

      // Attempt 2: Gemini Vision API for scanned PDFs (sends the PDF as base64)
      if (process.env.GEMINI_API_KEY) {
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
                  text: `Extract ALL text content from this scanned PDF document. This is a Request for Quotation (RFQ) or product specification document for industrial valves/piping.
                  
Return the COMPLETE text content exactly as it appears in the document, including:
- All product names, descriptions, and specifications
- All quantities, sizes, materials, pressure ratings
- All table data, line items, and technical details
- Company names, contact info, reference numbers
- Any headers, footers, and notes

Return ONLY the extracted text content. Do not add any commentary or formatting instructions.`
                }
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
            const extractedText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const trimmed = extractedText.trim();
            
            if (trimmed.length > 20) {
              console.log(`[File Parsing] ✅ Gemini Vision OCR extracted ${trimmed.length} chars from scanned PDF: ${fileName}`);
              return {
                text: trimmed,
                confidence: 90,
                status: 'SUCCESS',
                category
              };
            } else {
              console.log(`[File Parsing] Gemini Vision returned too little text (${trimmed.length} chars) for: ${fileName}`);
            }
          } else {
            const errBody = await geminiRes.text().catch(() => '');
            console.error(`[File Parsing] Gemini Vision API error ${geminiRes.status} for ${fileName}: ${errBody.substring(0, 300)}`);
          }
        } catch (geminiErr) {
          console.error(`[File Parsing] Gemini Vision OCR failed for ${fileName}: ${geminiErr.message}`);
        }
      }

      // Attempt 3: Groq does not support vision for PDFs, skip to Tesseract

      // Attempt 4: Tesseract OCR on PDF (limited — works only if Tesseract can interpret the buffer as image)
      console.log(`[File Parsing] Falling back to Tesseract OCR for PDF: ${fileName}`);
      try {
        const { data: { text, confidence } } = await Tesseract.recognize(buffer, 'eng');
        const trimmedText = (text || '').trim();
        console.log(`[File Parsing] Tesseract OCR on PDF got ${trimmedText.length} chars (confidence: ${confidence})`);
        if (trimmedText.length > 20) {
          return {
            text: trimmedText,
            confidence: confidence || 40,
            status: 'SUCCESS',
            category
          };
        }
      } catch (ocrErr) {
        console.error(`[File Parsing] Tesseract OCR also failed for PDF ${fileName}: ${ocrErr.message}`);
      }

      // Final fallback: return whatever we have
      return {
        text: pdfTextResult || '[Scanned PDF - OCR extraction unsuccessful]',
        confidence: pdfTextResult.length > 0 ? 50 : 0,
        status: pdfTextResult.length > 0 ? 'SUCCESS' : 'FAILED',
        category
      };
    }

    // 2. Excel Spreadsheets / CSV
    if (['xlsx', 'xls', 'csv'].includes(ext) || fileType.includes('spreadsheet') || fileType.includes('csv')) {
      console.log(`[File Parsing] Extracting text from Excel/CSV: ${fileName}`);
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let text = '';

      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        text += `\n--- Sheet: ${sheetName} ---\n`;
        text += XLSX.utils.sheet_to_txt(sheet) + '\n';
      });

      return {
        text: text.trim(),
        confidence: 100,
        status: 'SUCCESS',
        category
      };
    }

    // 3. Word Documents
    if (ext === 'docx' || fileType.includes('word')) {
      console.log(`[File Parsing] Extracting text from Word: ${fileName}`);
      const result = await mammoth.extractRawText({ buffer });
      return {
        text: (result.value || '').trim(),
        confidence: 100,
        status: 'SUCCESS',
        category
      };
    }

    // 4. Images (OCR via Gemini Vision → Tesseract.js fallback)
    if (['png', 'jpg', 'jpeg', 'tiff', 'tif'].includes(ext) || fileType.startsWith('image/')) {
      // Attempt 1: Gemini Vision API (better quality for complex documents)
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
                { text: `Extract ALL text content from this image. This may be a product specification sheet, RFQ, or technical document for industrial valves/piping. Return the COMPLETE text content exactly as it appears, including all product names, quantities, sizes, materials, pressure ratings, table data, and technical details. Return ONLY the extracted text.` }
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
              return { text: extractedText, confidence: 90, status: 'SUCCESS', category };
            }
          }
        } catch (geminiErr) {
          console.error(`[File Parsing] Gemini Vision OCR failed for image ${fileName}: ${geminiErr.message}`);
        }
      }

      // Attempt 2: Tesseract.js fallback
      console.log(`[File Parsing] Running Tesseract OCR on image: ${fileName}`);
      const { data: { text, confidence } } = await Tesseract.recognize(buffer, 'eng');
      return {
        text: (text || '').trim(),
        confidence: confidence || 70,
        status: 'SUCCESS',
        category
      };
    }

    // Default: unsupported text type
    console.log(`[File Parsing] Unsupported file format for text extraction: ${fileName}`);
    return {
      text: '',
      confidence: 100,
      status: 'NOT_SUPPORTED',
      category
    };

  } catch (err) {
    console.error(`[File Parsing] UNHANDLED ERROR extracting text from ${fileName}:`, err.message);
    console.error('[File Parsing] Full stack:', err.stack);
    return {
      text: '',
      confidence: 0,
      status: 'FAILED',
      category
    };
  }
}

/**
 * Saves file to S3 and creates/versions an Attachment record in the database.
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

    // 2. Extract text/OCR content
    const extractionResult = await extractTextFromFile(fileBuffer, fileType, originalFileName);

    // 3. Resolve version control
    // Find if this customer/thread already has an attachment with the exact same name
    const existing = await Attachment.findOne({
      customerId,
      threadId,
      originalFileName,
      parentAttachmentId: null // Find the original version
    });

    let versionNumber = 1;
    let parentAttachmentId = null;

    if (existing) {
      // Find the latest version number
      const latestVersion = await Attachment.findOne({
        $or: [
          { _id: existing._id },
          { parentAttachmentId: existing._id }
        ]
      }).sort({ versionNumber: -1 });

      versionNumber = (latestVersion ? latestVersion.versionNumber : 1) + 1;
      parentAttachmentId = existing._id;

      // Update all old versions to isLatestVersion = false
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

    // 4. Create the new Attachment record
    const attachment = await Attachment.create({
      customerId,
      threadId,
      originalMessageId,
      originalFileName,
      fileType,
      fileSize,
      storagePath,
      extractedText: extractionResult.text,
      extractionStatus: extractionResult.status,
      ocrConfidence: extractionResult.ocrConfidence || extractionResult.confidence,
      attachmentCategory: extractionResult.category,
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

module.exports = {
  extractTextFromFile,
  saveAndVersionAttachment,
  detectCategory
};

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
      if (_PDFParse) {
        try {
          const parser = new _PDFParse({ data: buffer });
          await parser.load();
          const result = await parser.getText();
          const text = (result.text || '').trim();
          console.log(`[File Parsing] PDF text extracted via PDFParse class: ${text.length} chars from ${fileName}`);

          if (text.length < 50) {
            console.log(`[File Parsing] PDF has very little text (${text.length} chars) — likely scanned: ${fileName}`);
            return {
              text: text || '[Scanned PDF - Text Not Extractable]',
              confidence: 50,
              status: 'SUCCESS',
              category
            };
          }

          return { text, confidence: 100, status: 'SUCCESS', category };
        } catch (pdfErr) {
          console.error(`[File Parsing] PDFParse class failed for ${fileName}: ${pdfErr.message}`);
          console.error('[File Parsing] Stack:', pdfErr.stack);
          // Fall through to Tesseract OCR image fallback below
        }
      }

      // Attempt 2: Tesseract OCR on PDF (for scanned PDFs where text extraction fails)
      console.log(`[File Parsing] Falling back to Tesseract OCR for PDF: ${fileName}`);
      try {
        const { data: { text, confidence } } = await Tesseract.recognize(buffer, 'eng');
        const trimmedText = (text || '').trim();
        console.log(`[File Parsing] Tesseract OCR on PDF got ${trimmedText.length} chars (confidence: ${confidence})`);
        return {
          text: trimmedText || '[Scanned PDF - OCR Failed]',
          confidence: confidence || 40,
          status: 'SUCCESS',
          category
        };
      } catch (ocrErr) {
        console.error(`[File Parsing] Tesseract OCR also failed for PDF ${fileName}: ${ocrErr.message}`);
        return { text: '[PDF text extraction failed]', confidence: 0, status: 'FAILED', category };
      }
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

    // 4. Images (OCR via Tesseract.js)
    if (['png', 'jpg', 'jpeg', 'tiff', 'tif'].includes(ext) || fileType.startsWith('image/')) {
      console.log(`[File Parsing] Running OCR via Tesseract on image: ${fileName}`);
      const { data: { text, confidence } } = await Tesseract.recognize(buffer, 'eng');
      return {
        text: (text || '').trim(),
        confidence: confidence || 70, // Tesseract returns confidence out of 100
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

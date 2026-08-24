const puppeteer = require('puppeteer');
const pdfStyles = require('./pdfStyles');
const { renderTechnicalPart1 } = require('./pages/technicalPart1');
const { renderContractReviewPart1 } = require('./pages/contractReviewPart1');
const { renderContractReviewPart2 } = require('./pages/contractReviewPart2');
const { renderPricePart2 } = require('./pages/pricePart2');
const { renderCommercialPart3 } = require('./pages/commercialPart3');

const CHUNK_SIZE = 8;

function chunkArray(array, size) {
  if (!array || array.length === 0) return [[]];
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Generates the complete official Petro Valves Quotation PDF buffer
 * @param {Object|string} quotationOrId
 * @returns {Promise<Buffer>} PDF Buffer
 */
async function generateQuotationPdf(quotationOrId) {
  let quotation = quotationOrId;
  if (typeof quotationOrId === 'string' || (quotationOrId && (quotationOrId._bsontype === 'ObjectID' || quotationOrId._bsontype === 'ObjectId'))) {
    const Quotation = require('../../models/Quotation');
    quotation = await Quotation.findById(quotationOrId)
      .populate('customer')
      .populate('enquiry')
      .populate('preparedBy', 'fullName')
      .populate('files');
  }

  const items = quotation.items || [];
  const itemChunks = chunkArray(items, CHUNK_SIZE);
  const totalChunks = itemChunks.length;

  const checklistPages = itemChunks.map((chunk, idx) => `
    <!-- CONTRACT REVIEW CHECKLIST (PART 1 - CHUNK ${idx + 1}/${totalChunks}) -->
    ${renderContractReviewPart1(quotation, chunk, idx, totalChunks)}

    <!-- CONTRACT REVIEW CHECKLIST (PART 2 & GENERAL - CHUNK ${idx + 1}/${totalChunks}) -->
    ${renderContractReviewPart2(quotation, chunk, idx, totalChunks)}
  `).join('\n');

  const pricePages = itemChunks.map((chunk, idx) => `
    <!-- PRICE PART - II (CHUNK ${idx + 1}/${totalChunks}) -->
    ${renderPricePart2(quotation, chunk, idx, totalChunks, idx === totalChunks - 1)}
  `).join('\n');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Quotation - ${quotation.quotationId || 'Official Quotation'}</title>
      <style>
        ${pdfStyles}
      </style>
    </head>
    <body>
      <!-- PAGE 1: TECHNICAL PART - I -->
      ${renderTechnicalPart1(quotation)}

      <!-- CONTRACT REVIEW CHECKLIST PAGES -->
      ${checklistPages}

      <!-- PRICE PART - II PAGES -->
      ${pricePages}

      <!-- COMMERCIAL PART - III -->
      ${renderCommercialPart3(quotation)}
    </body>
    </html>
  `;

  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote'
  ];

  const browser = await puppeteer.launch({
    headless: 'new',
    args: launchArgs,
    ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {})
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0px',
        bottom: '0px',
        left: '0px',
        right: '0px'
      }
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = {
  generateQuotationPdf
};

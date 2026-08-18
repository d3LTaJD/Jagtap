const puppeteer = require('puppeteer');
const pdfStyles = require('./pdfStyles');
const { renderTechnicalPart1 } = require('./pages/technicalPart1');
const { renderContractReviewPart1 } = require('./pages/contractReviewPart1');
const { renderContractReviewPart2 } = require('./pages/contractReviewPart2');
const { renderPricePart2 } = require('./pages/pricePart2');
const { renderCommercialPart3 } = require('./pages/commercialPart3');

/**
 * Generates the complete 5-page official Petro Valves Quotation PDF buffer
 * @param {Object} quotation
 * @returns {Promise<Buffer>} PDF Buffer
 */
async function generateQuotationPdf(quotation) {
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

      <!-- PAGE 2: CONTRACT REVIEW CHECKLIST (PART 1) -->
      ${renderContractReviewPart1(quotation)}

      <!-- PAGE 3: CONTRACT REVIEW CHECKLIST (PART 2 & GENERAL) -->
      ${renderContractReviewPart2(quotation)}

      <!-- PAGE 4: PRICE PART - II -->
      ${renderPricePart2(quotation)}

      <!-- PAGE 5: COMMERCIAL PART - III -->
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

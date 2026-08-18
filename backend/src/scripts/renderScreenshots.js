const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const pdfStyles = require('../services/quotationPdf/pdfStyles');
const { renderTechnicalPart1 } = require('../services/quotationPdf/pages/technicalPart1');
const { renderContractReviewPart1 } = require('../services/quotationPdf/pages/contractReviewPart1');
const { renderContractReviewPart2 } = require('../services/quotationPdf/pages/contractReviewPart2');
const { renderPricePart2 } = require('../services/quotationPdf/pages/pricePart2');
const { renderCommercialPart3 } = require('../services/quotationPdf/pages/commercialPart3');

async function renderVisualScreenshots() {
  const mockQuotation = {
    quotationId: 'PV/J/QTN/P-001/26-27',
    createdAt: new Date('2026-07-05'),
    senderCompany: 'ABC Constractor',
    clientName: 'ABC Constractor',
    customer: {
      companyName: 'ABC Constractor',
      address: 'Ahmedabad, Gujarat, India',
      mobileNumber: '+91 90237232XX',
      emailAddress: 'sales@petrovalves.co.in',
      primaryContactName: 'Mr. Jay'
    },
    enquiry: {
      createdAt: new Date('2026-07-05'),
      projectName: 'Pipeline Project',
      subject: 'Offer for Valves as per your requirements.'
    },
    contactMobile: '+91 90237232XX',
    contactEmail: 'sales@petrovalves.co.in',
    kindAttention: 'Mr. Jay',
    enquiryRefText: 'Your Enquiry by   E-Mail   on DT.   05/07/26',
    projectName: 'Pipeline Project',
    subjectText: 'Offer for Valves as per your requirements.',
    salutationOpeningText: 'We acknowledge with thanks the receipt of your above referred enquiry and we are pleased to submit our proposal as under.',
    technicalSpecificationClause: 'We offered our valves as per Specification given in Contract Review Check.',
    technicalDeviations: '',
    pricePartNotice: 'We offer our Valves as below, considering Contract Review Check (Format No. R/5.1.3.5/2 Rev04).',
    cert32Percent: 5,
    pfPercent: 5,
    tpiCharges: 60000,
    signatoryName: 'Jay Mistry',
    signatoryDesignation: '(Sales & Projects)',
    signatoryPhone: '9023723212',
    items: [
      {
        description: 'BALL VALVE 15MM 800#',
        quantity: 2,
        unitPrice: 2200,
        dynamicFields: {
          valve_type: 'BALL',
          valve_size: '15',
          valve_class: '800',
          valve_design_type: '3 P/C REDUCE BORE',
          valve_bore: 'REDUCE BORE',
          valve_end_connection: 'FLANGE',
          valve_operating: 'LEVER',
          valve_ball_type: 'SOLID BALL',
          valve_direction: 'Bi Directional',
          valve_service: 'GAS',
          valve_seat_type: 'Soft Seat',
          valve_design_std: 'BS 5351',
          valve_testing_std: 'API 598',
          valve_moc_body: 'ASTM A105',
          valve_moc_ball: '13% CR. STEEL',
          valve_moc_stem: '13% Cr. Steel',
          valve_moc_seat: '13% CR. STEEL',
          valve_moc_stud_nuts: 'ASTM A193 Gr. B7 & ASTM A194 Gr. 2H',
          valve_rt: 'No',
          valve_ut: 'No'
        }
      },
      {
        description: 'GLOBE VALVE 200MM 600#',
        quantity: 1,
        unitPrice: 205000,
        dynamicFields: {
          valve_type: 'GLOBE',
          valve_size: '200',
          valve_class: '600',
          valve_design_type: 'BB OS & Y',
          valve_bore: 'FULL BORE',
          valve_end_connection: 'FLANGE',
          valve_operating: 'GEAR',
          valve_ball_type: 'PLUG TYPE',
          valve_direction: 'Single Directional',
          valve_service: 'GAS',
          valve_seat_type: 'Metal Seat',
          valve_design_std: 'BS 1873',
          valve_testing_std: 'API 598',
          valve_moc_body: 'ASTM A216 Gr. WCB',
          valve_rt: 'Yes',
          valve_ut: 'No'
        }
      }
    ]
  };

  const pages = [
    { name: 'page_1_technical', html: renderTechnicalPart1(mockQuotation) },
    { name: 'page_2_contract_review_1', html: renderContractReviewPart1(mockQuotation) },
    { name: 'page_3_contract_review_2', html: renderContractReviewPart2(mockQuotation) },
    { name: 'page_4_price_part_2', html: renderPricePart2(mockQuotation) },
    { name: 'page_5_commercial_part_3', html: renderCommercialPart3(mockQuotation) }
  ];

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const targetDir = 'C:\\Users\\jeetd\\.gemini\\antigravity-ide\\brain\\ad68ba4a-ff89-4efb-ae90-d81c745dcb2b';

  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>${pdfStyles}</style>
      </head>
      <body>${p.html}</body>
      </html>
    `;
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    const outPath = path.join(targetDir, `generated_${p.name}.png`);
    await page.screenshot({ path: outPath, fullPage: true });
    console.log(`Saved screenshot: ${outPath}`);
  }

  await browser.close();
  console.log('All screenshots rendered successfully!');
}

renderVisualScreenshots()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

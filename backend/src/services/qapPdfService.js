const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

function formatDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '-';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

let cachedLogoBase64 = null;
function getLogoBase64() {
  if (cachedLogoBase64) return cachedLogoBase64;
  try {
    const p1 = 'd:/petrovalves/logo.png';
    const p2 = path.join(__dirname, '../../../logo.png');
    const p3 = path.join(__dirname, '../../frontend/src/logo.png');
    const target = fs.existsSync(p1) ? p1 : (fs.existsSync(p2) ? p2 : (fs.existsSync(p3) ? p3 : null));
    if (target) {
      const buf = fs.readFileSync(target);
      cachedLogoBase64 = `data:image/png;base64,${buf.toString('base64')}`;
      return cachedLogoBase64;
    }
  } catch (e) {
    console.error('[QAP PDF] Error loading logo:', e);
  }
  return '';
}

/**
 * Generate official Petro Valves Quality Assurance Plan PDF matching 3.1_QAP format
 * Orientation: A4 Landscape
 */
async function generateQapPdf(qap) {
  const logoBase64 = getLogoBase64();
  
  // Extract all dynamic values
  const qapNo = qap.qapNumber || qap.qapId || 'PV/QAP/INTERNAL';
  const revNo = qap.revisionNo || (qap.revision !== undefined ? String(qap.revision).padStart(2, '0') : '00');
  const qapDate = formatDate(qap.qapDate || qap.createdAt || new Date());
  
  const endUser = qap.endUser || qap.quotation?.dynamicFields?.end_user || 'M/s. THINK GAS DISTRIBUTION PVT. LTD.';
  const clientName = qap.clientName || qap.customer?.companyName || qap.quotation?.customer?.companyName || 'M/s. PLANT TECH INDUSTRIAL SERVICES LIMITED';
  const projectName = qap.projectName || qap.quotation?.projectName || qap.quotation?.title || 'THINK GAS (AG&P) PROJECT';
  const clientPoNo = qap.clientPoNo || qap.workOrder?.customerPoNumber || qap.quotation?.customerPoNumber || 'PTIS/HT/2026-27/JULY/47';
  const clientPoDate = formatDate(qap.clientPoDate || qap.workOrder?.customerPoDate || qap.quotation?.poDate || '2026-07-29');

  // Dynamic Valve Details
  const vd = qap.valveDetail || {};
  const valveType = (vd.valveType || 'BALL VALVES').toUpperCase();
  const designStd = (vd.designStandard || 'API 6D 25TH ED.').toUpperCase();
  const itemCode = vd.itemCode || 'P262704101';
  const sizeRatingEnd = `${vd.size || '100MM'} X ${vd.pressureClass || '300#'} (${vd.endConnection || 'BW'})`;

  const activities = qap.activities && qap.activities.length > 0 ? qap.activities : [];

  // Normalize activities and ensure each has sectionNo, sectionTitle, and component
  const normalizedActs = activities.map((act, i) => {
    let sNo = act.sectionNo;
    let sTitle = act.sectionTitle;
    let comp = act.component || '';

    if (!sNo) {
      const stage = (act.stageOfManufacture || '').toLowerCase();
      const name = (act.activityName || act.typeOfCheck || '').toLowerCase();
      if (stage.includes('pre-') || stage.includes('material') || stage.includes('heat') || name.includes('solution annealing')) {
        sNo = '1';
        sTitle = 'RAW MATERIAL (Critical)';
        if (!comp) comp = '1) Body, Side P/c, Bonnet, Trunnion';
      } else if (stage.includes('bought') || name.includes('fastener') || name.includes('pup')) {
        sNo = '2';
        sTitle = 'BOUGHTOUT ITEMS';
        if (!comp) comp = '1) Pressure boundry fastners. API 20 E BSL-1';
      } else if (stage.includes('ndt') || stage.includes('in-process') || stage.includes('machin') || name.includes('welding') || name.includes('radiograph') || name.includes('ultrasonic') || name.includes('penetrant') || name.includes('particle')) {
        sNo = '3';
        sTitle = 'INPROCESS INP.';
        if (!comp) comp = '1) Body, Side P/c, Ball, Stem';
      } else if (stage.includes('assembly')) {
        sNo = '4';
        sTitle = 'ASSEMBLY';
        if (!comp) comp = valveType.includes('BALL') ? 'Ball valve' : 'Valve Assembly';
      } else if (stage.includes('test') || stage.includes('final') || name.includes('hydro') || name.includes('torque') || name.includes('antistatic') || name.includes('fire safe')) {
        sNo = '5';
        sTitle = 'FINAL INSPECTIONS';
        if (!comp) comp = valveType.includes('BALL') ? 'Ball valve' : 'Valve Assembly';
      } else if (stage.includes('paint') || name.includes('dft') || name.includes('surface') || name.includes('protector')) {
        sNo = '6';
        sTitle = 'PAINTING';
        if (!comp) comp = valveType.includes('BALL') ? 'Ball valve' : 'Valve Assembly';
      } else {
        sNo = '7';
        sTitle = 'FINAL DOCUMENTATION';
        if (!comp) comp = 'Final Documentation';
      }
    }

    return {
      ...act,
      sectionNo: sNo,
      sectionTitle: sTitle,
      component: comp,
      typeOfCheck: act.typeOfCheck || act.activityName || '',
      quantumOfCheck: act.quantumOfCheck || act.frequency || '100%',
      referenceDocument: act.referenceDocument || '-',
      acceptanceNorms: act.acceptanceNorms || act.acceptanceCriteria || '-',
      formatOfRecord: act.formatOfRecord || act.recordType || 'Inspection Report',
      inHouseOutSource: act.inHouseOutSource || 'I',
      inspectionPvpl: act.inspectionPvpl || (act.inspectionType === 'H' ? 'P/H' : 'P'),
      inspectionTpi: act.inspectionTpi || (act.inspectionType === 'W' ? 'W' : (act.inspectionType === 'H' ? 'W' : 'R'))
    };
  });

  // Group activities into 4 balanced pages matching 3.1_QAP standard layout
  // Page 1: Section 1 Raw Material (Body, Bonnet, Ball, Stem)
  // Page 2: Seat Holder, Section 2 Boughtout, Section 3 Inprocess
  // Page 3: Section 4 Assembly, Section 5 Final Inspections, Section 6 Painting
  // Page 4: Section 7 Final Documentation, Notes, Remarks, Sign-off & Stamp
  const pagesData = [];

  const p1Acts = normalizedActs.filter(a => a.sectionNo === '1' && (!a.component || !a.component.toLowerCase().includes('seat')));
  const p2Acts = normalizedActs.filter(a => 
    (a.sectionNo === '1' && a.component && a.component.toLowerCase().includes('seat')) ||
    a.sectionNo === '2' || 
    a.sectionNo === '3'
  );
  const p3Acts = normalizedActs.filter(a => a.sectionNo === '4' || a.sectionNo === '5' || a.sectionNo === '6');
  const p4Acts = normalizedActs.filter(a => a.sectionNo === '7' || (!['1','2','3','4','5','6'].includes(a.sectionNo) && a.sectionNo));

  if (p1Acts.length > 0 || p2Acts.length > 0 || p3Acts.length > 0 || p4Acts.length > 0) {
    if (p1Acts.length) pagesData.push({ pageNum: pagesData.length + 1, activities: p1Acts, isLast: false });
    if (p2Acts.length) pagesData.push({ pageNum: pagesData.length + 1, activities: p2Acts, isLast: false });
    if (p3Acts.length) pagesData.push({ pageNum: pagesData.length + 1, activities: p3Acts, isLast: false });
    pagesData.push({ pageNum: pagesData.length + 1, activities: p4Acts, isLast: true });
  } else {
    // If not categorized by section, chunk dynamically (approx 12-14 items per page)
    const chunkSize = 12;
    for (let i = 0; i < normalizedActs.length; i += chunkSize) {
      const slice = normalizedActs.slice(i, i + chunkSize);
      pagesData.push({
        pageNum: pagesData.length + 1,
        activities: slice,
        isLast: i + chunkSize >= normalizedActs.length
      });
    }
    if (pagesData.length === 0) {
      pagesData.push({ pageNum: 1, activities: [], isLast: true });
    }
  }

  // Renumber total pages accurately
  pagesData.forEach((p, idx) => {
    p.pageNum = idx + 1;
    p.isLast = idx === pagesData.length - 1;
  });

  const totalPages = pagesData.length;

  const renderHeader = () => `
    <table class="header-box">
      <tr>
        <td class="hdr-left" style="width: 53%;">
          <div class="mfg-title">Manufactures: <span class="mfg-name">Petro Valves Pvt.Ltd.</span></div>
          <div class="hdr-meta"><strong>END USER :</strong> ${endUser}</div>
          <div class="hdr-meta"><strong>CLIENT :</strong> ${clientName}</div>
          <div class="hdr-meta"><strong>PROJECT :</strong> ${projectName}</div>
          <div class="hdr-meta" style="display: flex; justify-content: space-between;">
            <span><strong>CLIENT P.O. No.:</strong> ${clientPoNo}</span>
            <span style="margin-right: 15px;"><strong>DT.</strong> ${clientPoDate}</span>
          </div>
        </td>
        <td class="hdr-mid" style="width: 29%;">
          <div class="qap-meta-row"><strong>QAP No.:</strong> ${qapNo}</div>
          <div class="qap-meta-row" style="display: flex; justify-content: space-between;">
            <span><strong>REV No.:</strong> ${revNo}</span>
            <span><strong>DATED:</strong> ${qapDate}</span>
          </div>
          <div class="valve-box">
            <div class="valve-meta" style="font-weight: 800;">VALVES DETAIL : ${valveType}</div>
            <div class="valve-meta">(FOR ${designStd})</div>
            <div class="valve-meta">${itemCode}</div>
            <div class="valve-meta" style="font-weight: 700;">${sizeRatingEnd}</div>
          </div>
        </td>
        <td class="hdr-right" style="width: 18%;">
          ${logoBase64 ? `<img src="${logoBase64}" alt="Petro Valves" class="header-logo" />` : ''}
          <div class="logo-subtext">Petro Valves Pvt. Ltd.</div>
        </td>
      </tr>
    </table>
    <div class="title-banner">QUALITY ASSURANCE PLAN</div>
  `;

  const renderTableHead = () => `
    <thead>
      <tr class="th-row-1">
        <th rowspan="2" style="width: 4%;">Sr.<br>No.</th>
        <th rowspan="2" style="width: 17%;">COMPONENTS &amp;<br>OPERATIONS</th>
        <th rowspan="2" style="width: 18%;">TYPE OF CHECK</th>
        <th rowspan="2" style="width: 11%;">QUANTAM OF CHECK</th>
        <th rowspan="2" style="width: 14%;">REFERANCE DOCUMENT</th>
        <th rowspan="2" style="width: 14%;">ACCEPTANCE NORMS</th>
        <th rowspan="2" style="width: 12%;">FORMAT OF RECORD</th>
        <th rowspan="2" style="width: 4%;">IN HOUSE (I) /<br>OUT SOURCE(O)</th>
        <th colspan="2" style="width: 6%;">INSPECTION</th>
      </tr>
      <tr class="th-row-2">
        <th class="sub-th" style="width: 3%;">PVPL/<br>SUPPLIER</th>
        <th class="sub-th" style="width: 3%;">TPI / CLIENT</th>
      </tr>
    </thead>
  `;

  const renderFooter = (pageNum, isLast) => `
    <div class="footer-wrap">
      ${isLast ? `
      <div class="notes-remarks-box">
        <div class="notes-line"><strong>Note:</strong> P - Perform, &nbsp;R - Review :- Doc/MTC/Inspection Reports will be reviewed, &nbsp;H - Hold:- Without completion of this stage further stage shall not be performed, &nbsp;W - Witness:- Test Will be performed in their presence, &nbsp;* - When required by contracts / Customer.</div>
        <div class="remarks-title"><strong>Remark:</strong></div>
        <div class="remark-item">1) For Material Specification refer "Material Specification Sheet" No. R-5.5.2-2 Rev.01 for Respective Material Grade &amp; Approved GAD.</div>
        <div class="remark-item">2) For Pup welding and overlay welding refer WPS/PQR made by Petro Valves Pvt. Limited</div>
        <div class="remark-item">3) For NDT (LPT, UT, RT, MPT, Helium leak test) &amp; Final Testing if QSL Level given by client follow table of API 6D Ann-I.</div>
        <div class="remark-item">4) When Revision / Edition of Standard/documents are not given in QAP then latest edition / Rev. applies after its effectiveness.</div>
        <div class="remark-item">5) ENP, Hydro test, and Painting Refer Procedure of Petro Valves Pvt. Ltd for reference and Acceptance.</div>
      </div>
      ` : ''}

      <table class="footer-sign-table">
        <tr>
          <td style="width: 32%; text-align: left; font-size: 7.5pt; font-weight: bold; color: #222;">
            Format No.R/5.2/1 &nbsp;Rev01 Effective From 15-Sept-2022
          </td>
          <td style="width: 20%; text-align: center; font-size: 8.5pt; font-weight: bold; color: #111;">
            Prepared BY: ${qap.preparedByName || 'QC Engg.'}
          </td>
          <td style="width: 16%; text-align: center; vertical-align: middle;">
            <!-- Official Petro Valves QC Stamp Seal -->
            <svg class="qc-stamp" viewBox="0 0 160 160" width="68" height="68">
              <circle cx="80" cy="80" r="74" fill="none" stroke="#2255a4" stroke-width="3" stroke-dasharray="6,3" />
              <circle cx="80" cy="80" r="66" fill="none" stroke="#2255a4" stroke-width="1.8" />
              <circle cx="80" cy="80" r="46" fill="none" stroke="#2255a4" stroke-width="1.2" />
              <path id="txtPathTop" d="M 24 80 A 56 56 0 0 1 136 80" fill="none" stroke="none" />
              <path id="txtPathBottom" d="M 136 80 A 56 56 0 0 1 24 80" fill="none" stroke="none" />
              <text font-family="Arial, sans-serif" font-size="11" font-weight="900" fill="#2255a4" letter-spacing="1.5">
                <textPath href="#txtPathTop" startOffset="50%" text-anchor="middle">PETRO VALVES PVT. LTD.</textPath>
              </text>
              <text font-family="Arial, sans-serif" font-size="10" font-weight="800" fill="#2255a4" letter-spacing="2">
                <textPath href="#txtPathBottom" startOffset="50%" text-anchor="middle">&#9733; AHMEDABAD &#9733;</textPath>
              </text>
              <text x="80" y="76" font-family="Arial, sans-serif" font-size="12" font-weight="900" fill="#2255a4" text-anchor="middle">QUALITY</text>
              <text x="80" y="92" font-family="Arial, sans-serif" font-size="11" font-weight="900" fill="#2255a4" text-anchor="middle">CONTROL</text>
            </svg>
          </td>
          <td style="width: 14%; text-align: center; font-size: 8.5pt; font-weight: 800; color: #111;">
            ${pageNum} OF ${totalPages}
          </td>
          <td style="width: 18%; text-align: right; font-size: 8.5pt; font-weight: bold; color: #111;">
            Approved By: ${qap.approvedByName || 'Incharge Q.C.'}
          </td>
        </tr>
      </table>
    </div>
  `;

  // Build Pages HTML
  let pagesHtml = '';

  pagesData.forEach((pg, pIdx) => {
    let rowsHtml = '';
    let currentSection = '';
    let currentComponent = '';

    pg.activities.forEach((act, actIdx) => {
      // Section header row
      if (act.sectionTitle && act.sectionTitle !== currentSection) {
        currentSection = act.sectionTitle;
        rowsHtml += `
          <tr class="section-row">
            <td class="sec-num">${act.sectionNo || ''}</td>
            <td colspan="9" class="sec-title">${act.sectionTitle}</td>
          </tr>
        `;
      }

      // Component label
      const compLabel = act.component || '';
      const isNewComp = compLabel !== currentComponent;
      if (isNewComp) {
        currentComponent = compLabel;
      }

      rowsHtml += `
        <tr class="act-row">
          <td class="cell-center" style="font-size: 7.5pt; color: #555;">${act.srNo || (actIdx + 1)}</td>
          <td class="cell-comp font-bold">${compLabel}</td>
          <td class="cell-check">${act.typeOfCheck || act.activityName || ''}</td>
          <td class="cell-center">${act.quantumOfCheck || act.frequency || '100%'}</td>
          <td class="cell-ref">${act.referenceDocument || '-'}</td>
          <td class="cell-norms">${act.acceptanceNorms || act.acceptanceCriteria || '-'}</td>
          <td class="cell-format">${act.formatOfRecord || act.recordType || 'Inspection Report'}</td>
          <td class="cell-center font-bold">${act.inHouseOutSource || 'I'}</td>
          <td class="cell-center font-bold">${act.inspectionPvpl || 'P'}</td>
          <td class="cell-center font-bold">${act.inspectionTpi || 'R'}</td>
        </tr>
      `;
    });

    // If empty page (fallback)
    if (!rowsHtml) {
      rowsHtml = `<tr><td colspan="10" style="text-align: center; padding: 20px; font-style: italic; color: #888;">No activities recorded for this stage.</td></tr>`;
    }

    pagesHtml += `
      <div class="qap-page ${pIdx < totalPages - 1 ? 'page-break' : ''}">
        <div class="page-border-box">
          ${renderHeader()}
          <table class="qap-table">
            ${renderTableHead()}
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          ${renderFooter(pg.pageNum, pg.isLast)}
        </div>
      </div>
    `;
  });

  const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>QAP - ${qapNo}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 6mm 6mm 6mm 6mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 8pt;
      color: #000;
      margin: 0;
      padding: 0;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page-break {
      page-break-after: always;
      break-after: page;
    }
    .qap-page {
      width: 100%;
      height: 100%;
      padding: 0;
      margin: 0;
    }
    .page-border-box {
      border: 1.8px solid #000;
      width: 100%;
      min-height: 194mm;
      position: relative;
      padding-bottom: 2px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    /* Header Box */
    .header-box {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 1.5px solid #000;
      table-layout: fixed;
    }
    .header-box td {
      border: 1px solid #000;
      padding: 4px 6px;
      vertical-align: top;
    }
    .mfg-title {
      font-size: 11pt;
      font-weight: 800;
      color: #000;
      margin-bottom: 3px;
    }
    .mfg-name {
      color: #0b3b60;
      font-size: 11.5pt;
      font-weight: 900;
    }
    .hdr-meta {
      font-size: 7.5pt;
      line-height: 1.35;
      color: #111;
    }
    .qap-meta-row {
      font-size: 7.8pt;
      line-height: 1.35;
      padding-bottom: 2px;
      border-bottom: 1px solid #777;
      margin-bottom: 2px;
    }
    .valve-box {
      padding-top: 2px;
      font-size: 7.5pt;
      line-height: 1.25;
      text-align: center;
    }
    .valve-meta {
      color: #111;
    }
    .hdr-right {
      text-align: center;
      vertical-align: middle !important;
      background: #fafafa;
    }
    .header-logo {
      max-height: 38px;
      max-width: 120px;
      object-fit: contain;
      display: block;
      margin: 0 auto 3px auto;
    }
    .logo-subtext {
      font-size: 8.5pt;
      font-weight: 900;
      color: #c0392b;
      letter-spacing: 0.3px;
    }

    /* Title Banner */
    .title-banner {
      width: 100%;
      text-align: center;
      font-size: 10.5pt;
      font-weight: 900;
      font-style: italic;
      color: #000;
      padding: 3px 0;
      border-bottom: 1.5px solid #000;
      letter-spacing: 1px;
      background: #f4f6f8;
    }

    /* Main Table */
    .qap-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      flex-grow: 1;
    }
    .qap-table th, .qap-table td {
      border: 1px solid #000;
      padding: 2.5px 3.5px;
      font-size: 7.2pt;
      line-height: 1.2;
      vertical-align: middle;
      word-wrap: break-word;
    }
    .qap-table thead th {
      background: #fff;
      font-weight: 800;
      text-align: center;
      font-size: 7pt;
      padding: 3px 2px;
    }
    .th-row-1 th {
      border-bottom: 1px solid #000;
    }
    .sub-th {
      font-size: 6.5pt !important;
      font-weight: 800;
    }

    /* Section row */
    .section-row td {
      background: #f0f3f6;
      font-weight: 900;
      font-size: 7.8pt;
      padding: 3px 5px;
      border-top: 1.5px solid #000;
      border-bottom: 1.5px solid #000;
    }
    .sec-num {
      text-align: center;
      width: 4%;
    }
    .sec-title {
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0b3b60;
    }

    /* Cells */
    .cell-center {
      text-align: center;
    }
    .cell-comp {
      font-size: 7.2pt;
      color: #000;
    }
    .cell-check {
      font-size: 7.2pt;
    }
    .cell-ref {
      font-size: 6.8pt;
    }
    .cell-norms {
      font-size: 6.8pt;
    }
    .cell-format {
      font-size: 6.8pt;
    }
    .font-bold {
      font-weight: 700;
    }

    /* Footer & Notes */
    .footer-wrap {
      width: 100%;
      border-top: 1.5px solid #000;
      padding: 3px 6px;
      background: #fff;
    }
    .notes-remarks-box {
      font-size: 6.8pt;
      line-height: 1.3;
      border-bottom: 1px solid #444;
      padding-bottom: 3px;
      margin-bottom: 3px;
      color: #222;
    }
    .notes-line {
      margin-bottom: 2px;
    }
    .remarks-title {
      font-weight: 800;
      margin-top: 1px;
    }
    .remark-item {
      padding-left: 6px;
    }
    .footer-sign-table {
      width: 100%;
      border-collapse: collapse;
    }
    .footer-sign-table td {
      padding: 2px 4px;
      vertical-align: middle;
    }
    .qc-stamp {
      display: inline-block;
      vertical-align: middle;
      opacity: 0.88;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>
  `;

  // Launch Puppeteer with production arguments
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '6mm', bottom: '6mm', left: '6mm', right: '6mm' }
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = {
  generateQapPdf
};

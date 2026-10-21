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

/**
 * Generate official Petro Valves Bill of Material (BOM) PDF
 * Exact 1:1 match to format: 450MM X 600# FB BW TMBV G.B. OPT.xlsx.pdf
 */
async function generateBomPdf(bom) {
  const ds = bom.designSpecs || {};
  const vs = bom.valveSpecs || {};

  const bomNo = bom.bomNumber || bom.bomId || 'BOM/BV02FBW04GTX450A000';
  const bomDate = formatDate(bom.bomDate || bom.createdAt || new Date());
  
  const sizeClassEnd = ds.sizeClassEndDetail || `${vs.size || '450MM'} ${vs.pressureClass || '600#'} & ${(vs.endConnection || 'BUTTWELD END').toUpperCase()}`;
  const typeDesignOpt = ds.typeDesignOpt || `${(vs.valveType || 'TRUNNION MOUNTED BALL VALVE').toUpperCase()} & GEAR BOX OPT.`;
  const boreDetail = ds.boreDetail || 'FULL BORE';
  const quantity = ds.quantity || `${String(bom.components?.[0]?.totalRequiredQty || 1).padStart(2, '0')} NOS`;
  const mfgStd = ds.mfgStandard || vs.designStandard || 'API 6D : 25th ED';
  const testingStd = ds.testingStandard || 'API 6D : 25th ED';
  const weight = ds.weight || 'APPROX. 2508 KG.';

  const components = (bom.components && bom.components.length > 0) ? bom.components : [];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Bill of Material - ${bomNo}</title>
<style>
  @page {
    size: A4 portrait;
    margin: 8mm 8mm 8mm 8mm;
  }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
    margin: 0;
    padding: 0;
    color: #000;
    font-size: 8.5pt;
    line-height: 1.15;
    background: #fff;
  }
  .bom-container {
    width: 100%;
    border: 1.5px solid #000;
    border-collapse: collapse;
  }
  .header-table {
    width: 100%;
    border-collapse: collapse;
  }
  .header-table td {
    padding: 4px 6px;
    vertical-align: middle;
  }
  .company-title {
    font-size: 13pt;
    font-weight: bold;
    text-align: center;
    letter-spacing: 0.5px;
    padding-top: 4px;
    padding-bottom: 2px;
  }
  .bom-title-row {
    border-top: 1.2px solid #000;
    border-bottom: 1.2px solid #000;
  }
  .bom-title {
    font-size: 10.5pt;
    font-weight: bold;
    text-align: center;
    letter-spacing: 1px;
    width: 58%;
    border-right: 1.2px solid #000;
  }
  .bom-meta {
    font-size: 8pt;
    font-weight: bold;
    padding-left: 8px !important;
  }
  .spec-table {
    width: 100%;
    border-collapse: collapse;
    border-bottom: 1.2px solid #000;
  }
  .spec-header-row th {
    background: #f4f4f4;
    font-size: 8.5pt;
    font-weight: bold;
    text-align: left;
    padding: 3px 6px;
    border-bottom: 1px solid #000;
  }
  .spec-table td {
    padding: 2.5px 6px;
    border-bottom: 1px solid #ccc;
    font-size: 8pt;
  }
  .spec-table tr:last-child td {
    border-bottom: none;
  }
  .spec-label {
    width: 32%;
    font-weight: bold;
    border-right: 1px solid #000;
  }
  .spec-val {
    width: 68%;
    font-weight: bold;
  }

  .parts-table {
    width: 100%;
    border-collapse: collapse;
  }
  .parts-table th {
    background: #f4f4f4;
    border-top: 1.2px solid #000;
    border-bottom: 1.2px solid #000;
    border-right: 1px solid #000;
    padding: 3px 4px;
    font-size: 7.5pt;
    font-weight: bold;
    text-align: center;
    line-height: 1.1;
  }
  .parts-table th:last-child {
    border-right: none;
  }
  .parts-table td {
    border-bottom: 1px solid #ddd;
    border-right: 1px solid #000;
    padding: 2px 4px;
    font-size: 7.5pt;
    vertical-align: middle;
  }
  .parts-table td:last-child {
    border-right: none;
  }
  .col-part-name {
    width: 31%;
    text-align: left;
    font-weight: bold;
  }
  .col-drg-no {
    width: 28%;
    text-align: center;
    font-family: "Courier New", monospace;
    font-size: 7pt;
    font-weight: bold;
  }
  .col-rev {
    width: 8%;
    text-align: center;
  }
  .col-qty {
    width: 9%;
    text-align: center;
    font-weight: bold;
  }
  .col-remark {
    width: 24%;
    text-align: left;
    font-size: 7pt;
    padding-left: 6px !important;
  }

  .notes-box {
    border-top: 1.2px solid #000;
    padding: 4px 6px;
    font-size: 7.5pt;
    line-height: 1.35;
    background: #fafafa;
  }
  .notes-box strong {
    font-weight: bold;
  }
</style>
</head>
<body>

<div class="bom-container">
  <!-- COMPANY HEADER -->
  <table class="header-table">
    <tr>
      <td colspan="2" class="company-title">Petro Valves Pvt. Ltd.</td>
    </tr>
    <tr class="bom-title-row">
      <td class="bom-title">BILL OF MATERIAL</td>
      <td class="bom-meta">
        <div>NO.: ${bomNo}</div>
        <div>DATE: ${bomDate}</div>
      </td>
    </tr>
  </table>

  <!-- DESIGN SPECIFICATION SECTION -->
  <table class="spec-table">
    <tr class="spec-header-row">
      <th colspan="2">DESIGN SPECIFICATION</th>
    </tr>
    <tr>
      <td class="spec-label">SIZE, CLASS & END DETAIL</td>
      <td class="spec-val">${sizeClassEnd}</td>
    </tr>
    <tr>
      <td class="spec-label">TYPE / DESIGN & OPT.</td>
      <td class="spec-val">${typeDesignOpt}</td>
    </tr>
    <tr>
      <td class="spec-label">BORE DETAIL</td>
      <td class="spec-val">${boreDetail}</td>
    </tr>
    <tr>
      <td class="spec-label">QUANTITY</td>
      <td class="spec-val">${quantity}</td>
    </tr>
    <tr>
      <td class="spec-label">MFG. STANDARD</td>
      <td class="spec-val">${mfgStd}</td>
    </tr>
    <tr>
      <td class="spec-label">TESTING STANDARD</td>
      <td class="spec-val">${testingStd}</td>
    </tr>
    <tr>
      <td class="spec-label">WEIGHT</td>
      <td class="spec-val">${weight}</td>
    </tr>
  </table>

  <!-- PARTS LIST TABLE -->
  <table class="parts-table">
    <thead>
      <tr>
        <th class="col-part-name">PART NAME</th>
        <th class="col-drg-no">DRG No.</th>
        <th class="col-rev">REV. No.</th>
        <th class="col-qty">No. of QTY.</th>
        <th class="col-remark">REMARK:- IF ANY ALTERNATIVE IDENTIFICATION NO.</th>
      </tr>
    </thead>
    <tbody>
      ${components.map(comp => {
        const rawName = comp.rawPartName || (comp.partName + (comp.isCritical ? '*' : '') + (comp.isPressureContaining ? '•' : '') + (comp.isPressureControlling ? '◊' : ''));
        const drg = comp.drgNo || '---';
        const rev = comp.revNo || (drg !== '---' ? '01' : '');
        const qty = comp.qtyPerValve !== undefined && comp.qtyPerValve !== null ? comp.qtyPerValve : (comp.totalRequiredQty || '');
        const remark = comp.remark || '';

        return `<tr>
          <td class="col-part-name">${rawName}</td>
          <td class="col-drg-no">${drg}</td>
          <td class="col-rev">${rev}</td>
          <td class="col-qty">${qty}</td>
          <td class="col-remark">${remark}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>

  <!-- FOOTER NOTES -->
  <div class="notes-box">
    <strong>NOTES:-</strong> * TO BE CRITICAL PARTS AND OTHERS ARE NON-CRITICAL PARTS.<br>
    • TO BE PRESSURE CONTAINING PARTS.<br>
    ◊ TO BE PRESSURE CONTROLLING PARTS.
  </div>
</div>

</body>
</html>`;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' }
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = {
  generateBomPdf
};

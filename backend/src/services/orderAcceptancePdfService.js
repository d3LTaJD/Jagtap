const puppeteer = require('puppeteer');

function formatCurrency(val) {
  if (val === undefined || val === null || isNaN(val)) return '₹ 0';
  return '₹ ' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function formatDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '-';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/**
 * Generate official Petro Valves Order Acceptance PDF matching Dummy_Order Acceptance.pdf
 */
async function generateOrderAcceptancePdf(orderAcceptance) {
  const oa = orderAcceptance;
  const customer = oa.customer || {};
  const items = oa.items || [];

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Order Acceptance - ${oa.oaNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm 12mm 10mm;
    }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 9pt;
      color: #111;
      margin: 0;
      padding: 0;
      line-height: 1.3;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
    }
    .company-title {
      font-size: 16pt;
      font-weight: 800;
      color: #0b3b60;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .company-sub {
      font-size: 8pt;
      color: #555;
    }
    .oa-title-badge {
      display: inline-block;
      background: #0b3b60;
      color: #fff;
      font-size: 11pt;
      font-weight: 700;
      padding: 4px 14px;
      border-radius: 3px;
      letter-spacing: 1px;
    }
    .meta-box {
      width: 100%;
      border: 1px solid #222;
      border-collapse: collapse;
      margin-bottom: 8px;
      font-size: 8.5pt;
    }
    .meta-box td {
      border: 1px solid #777;
      padding: 4px 6px;
      vertical-align: top;
    }
    .lbl {
      font-weight: 700;
      color: #222;
    }
    .val {
      color: #000;
    }
    /* Items Table */
    .items-table {
      width: 100%;
      border: 1px solid #222;
      border-collapse: collapse;
      margin-bottom: 8px;
      font-size: 8pt;
    }
    .items-table th {
      background: #f0f4f8;
      border: 1px solid #444;
      padding: 5px 3px;
      font-weight: 700;
      text-align: center;
      color: #0b3b60;
    }
    .items-table td {
      border: 1px solid #777;
      padding: 4px 3px;
      text-align: center;
    }
    .items-table td.left {
      text-align: left;
      padding-left: 5px;
    }
    .items-table td.right {
      text-align: right;
      padding-right: 5px;
    }
    .tot-row td {
      font-weight: 700;
      background: #fafbfc;
    }
    /* Terms Table */
    .terms-table {
      width: 100%;
      border: 1px solid #444;
      border-collapse: collapse;
      font-size: 8pt;
      margin-bottom: 10px;
    }
    .terms-table td {
      border: 1px solid #888;
      padding: 3px 6px;
      vertical-align: top;
    }
    .terms-lbl {
      width: 25%;
      font-weight: 700;
      background: #f7f9fa;
    }
    .notice-box {
      border: 1px dashed #0b3b60;
      background: #fbfcfe;
      padding: 6px;
      font-size: 7.5pt;
      margin-bottom: 12px;
      line-height: 1.35;
    }
    .sig-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
      font-size: 8pt;
    }
    .sig-table td {
      width: 33.33%;
      text-align: center;
      padding-top: 35px;
      border-top: 1px solid #555;
      font-weight: 700;
    }
  </style>
</head>
<body>

  <!-- Header -->
  <table class="header-table">
    <tr>
      <td style="width: 65%;">
        <div class="company-title">Petro Valves Pvt. Ltd.</div>
        <div class="company-sub">Plot No. 12/B, Kuha GIDC, Tal. Daskroi, Dist. Ahmedabad - 382433, Gujarat, India</div>
        <div class="company-sub">Email: sales@petrovalves.co.in | Web: www.petrovalves.co.in | GSTIN: 24AABCP1234F1ZQ</div>
      </td>
      <td style="width: 35%; text-align: right; vertical-align: top;">
        <div class="oa-title-badge">ORDER ACCEPTANCE</div>
      </td>
    </tr>
  </table>

  <!-- Metadata Table -->
  <table class="meta-box">
    <tr>
      <td style="width: 20%;"><span class="lbl">NO.:</span> <span class="val">${oa.oaNumber}</span></td>
      <td style="width: 30%;"><span class="lbl">DATE:</span> <span class="val">${formatDate(oa.oaDate)}</span></td>
      <td style="width: 25%;"><span class="lbl">W.O. NO:</span> <span class="val">${oa.workOrder?.workOrderId || oa.oaNumber}</span></td>
      <td style="width: 25%;"><span class="lbl">W.O. DATE:</span> <span class="val">${formatDate(oa.oaDate)}</span></td>
    </tr>
    <tr>
      <td colspan="2" rowspan="3">
        <span class="lbl">Name Of Customer:</span><br>
        <strong>${customer.companyName || 'Valued Customer'}</strong><br>
        ${customer.billingAddress?.street || ''} ${customer.billingAddress?.city || ''} ${customer.billingAddress?.state || ''}<br>
        <span class="lbl">Email:</span> ${customer.emailAddress || '-'}<br>
        <span class="lbl">Tel No:</span> ${customer.mobileNumber || '-'}<br>
        <span class="lbl">GST No:</span> ${customer.gstNumber || '-'}
      </td>
      <td><span class="lbl">FOA / PO No.:</span> <span class="val">${oa.customerPoNumber}</span></td>
      <td><span class="lbl">PO Date:</span> <span class="val">${formatDate(oa.customerPoDate)}</span></td>
    </tr>
    <tr>
      <td><span class="lbl">TPIA Scope:</span> <span class="val">${oa.tpiaScope} ${oa.tpiaAgencyName ? `(${oa.tpiaAgencyName})` : ''}</span></td>
      <td><span class="lbl">L.D. Applicable:</span> <span class="val">${oa.ldApplicable ? 'Yes' : 'No'}</span></td>
    </tr>
    <tr>
      <td colspan="2" style="background: #fff8e6;">
        <span class="lbl" style="color: #b45309;">Customer Delivery Date (CDD):</span> 
        <strong style="color: #b45309; font-size: 9.5pt;">${formatDate(oa.customerDeliveryDate)}</strong>
      </td>
    </tr>
  </table>

  <!-- Line Items Table -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 4%;">Sr</th>
        <th style="width: 14%;">Valve Type</th>
        <th style="width: 8%;">Design</th>
        <th style="width: 7%;">Bore</th>
        <th style="width: 10%;">End Type</th>
        <th style="width: 10%;">Operating</th>
        <th style="width: 8%;">Ball Type</th>
        <th style="width: 10%;">Size</th>
        <th style="width: 7%;">Class</th>
        <th style="width: 6%;">Qty</th>
        <th style="width: 8%;">Rate</th>
        <th style="width: 8%;">Total Amount</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((it, idx) => `
        <tr>
          <td>${it.itemNo || idx + 1}</td>
          <td class="left"><strong>${it.valveType || '-'}</strong></td>
          <td>${it.designType || '-'}</td>
          <td>${it.bore || 'Full'}</td>
          <td>${it.endType || 'Flange'}</td>
          <td>${it.operating || 'Handwheel'}</td>
          <td>${it.ballType || '-'}</td>
          <td>${it.size || '-'}</td>
          <td>${it.pressureClass || '-'}</td>
          <td><strong>${it.quantity || 1}</strong></td>
          <td class="right">${formatCurrency(it.unitRate)}</td>
          <td class="right"><strong>${formatCurrency(it.totalAmount)}</strong></td>
        </tr>
      `).join('')}
      <tr class="tot-row">
        <td colspan="9" class="right"><strong>Total Quantity & Basic Value:</strong></td>
        <td><strong>${oa.totalQuantity}</strong></td>
        <td>-</td>
        <td class="right"><strong>${formatCurrency(oa.subtotal)}</strong></td>
      </tr>
      <tr>
        <td colspan="11" class="right" style="padding-right: 8px;">GST (${oa.gstRate}%):</td>
        <td class="right">${formatCurrency(oa.gstAmount)}</td>
      </tr>
      <tr class="tot-row" style="background: #eef4fa;">
        <td colspan="11" class="right" style="padding-right: 8px; font-size: 8.5pt; color: #0b3b60;"><strong>Grand Total (Incl. GST):</strong></td>
        <td class="right" style="font-size: 9pt; color: #0b3b60;"><strong>${formatCurrency(oa.grandTotal)}</strong></td>
      </tr>
    </tbody>
  </table>

  <!-- Commercial Terms Table -->
  <table class="terms-table">
    <tr>
      <td class="terms-lbl">Prices Basis :</td>
      <td>${oa.priceBasis}</td>
      <td class="terms-lbl">Delivery Terms :</td>
      <td>${oa.deliveryTerms}</td>
    </tr>
    <tr>
      <td class="terms-lbl">Packing & Forwarding :</td>
      <td>${oa.packingForwarding}</td>
      <td class="terms-lbl">Certification :</td>
      <td>${oa.certification}</td>
    </tr>
    <tr>
      <td class="terms-lbl">Freight :</td>
      <td>${oa.freight}</td>
      <td class="terms-lbl">Guarantee / Warranty :</td>
      <td>${oa.guarantee}</td>
    </tr>
    <tr>
      <td class="terms-lbl">Tax & Duty :</td>
      <td>${oa.taxDuty}</td>
      <td class="terms-lbl">TPIA Charges :</td>
      <td>${oa.thirdPartyInspection}</td>
    </tr>
    <tr>
      <td class="terms-lbl">Terms of Payment :</td>
      <td colspan="3"><strong style="color: #0b3b60;">${oa.termsOfPayment}</strong></td>
    </tr>
  </table>

  <!-- Standard Petro Valves Cancellation & Compliance Clause -->
  <div class="notice-box">
    <strong>Please Note:</strong> We are Mfg/Deliver material from Unit-II (API 6D Monogram Unit) & Non-API valves from Unit-I.<br>
    <strong>PO Cancellation or Modification Charges:</strong><br>
    ${oa.cancellationPolicy}<br>
    <strong>Jurisdiction:</strong> ${oa.jurisdiction}
  </div>

  <!-- Signatures -->
  <table class="sig-table">
    <tr>
      <td>Prepared By (Marketing / Sales)</td>
      <td>Approved By (Technical / QA)</td>
      <td>Incharge Marketing & Commercial</td>
    </tr>
  </table>

</body>
</html>
  `;

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
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = {
  generateOrderAcceptancePdf
};

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

function inWords(num) {
  if (!num) return 'Zero Rupees Only';
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n) {
    if (n === 0) return '';
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : ' ');
    if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + (n % 100 !== 0 ? 'and ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 !== 0 ? convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 !== 0 ? convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 !== 0 ? convert(n % 10000000) : '');
  }

  const intPart = Math.floor(num);
  return 'Rupees ' + convert(intPart).trim() + ' Only';
}

/**
 * Generate official Customer 10% Advance Proforma Invoice PDF
 */
async function generateCustomerProformaInvoicePdf(proformaInvoice) {
  const pi = proformaInvoice;
  const customer = pi.customer || {};
  const oa = pi.orderAcceptance || {};

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Proforma Invoice - ${pi.piNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 12mm 12mm 12mm;
    }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 9pt;
      color: #111;
      margin: 0;
      padding: 0;
      line-height: 1.35;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
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
    .pi-title-badge {
      display: inline-block;
      background: #047857;
      color: #fff;
      font-size: 11pt;
      font-weight: 700;
      padding: 4px 14px;
      border-radius: 3px;
      letter-spacing: 0.5px;
    }
    .meta-box {
      width: 100%;
      border: 1px solid #333;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 8.5pt;
    }
    .meta-box td {
      border: 1px solid #777;
      padding: 5px 8px;
      vertical-align: top;
    }
    .lbl {
      font-weight: 700;
      color: #222;
    }
    .items-table {
      width: 100%;
      border: 1px solid #333;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 8.5pt;
    }
    .items-table th {
      background: #f0f7f4;
      border: 1px solid #555;
      padding: 6px;
      font-weight: 700;
      color: #047857;
      text-align: center;
    }
    .items-table td {
      border: 1px solid #777;
      padding: 6px 8px;
    }
    .items-table td.right {
      text-align: right;
    }
    .tot-row td {
      font-weight: 700;
      background: #fcfdfd;
    }
    .bank-box {
      border: 1px solid #0b3b60;
      background: #f4f8fb;
      padding: 8px 12px;
      margin-bottom: 14px;
      font-size: 8.5pt;
      border-radius: 3px;
    }
    .bank-title {
      font-weight: 800;
      color: #0b3b60;
      font-size: 9pt;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    .terms-box {
      border: 1px dashed #777;
      padding: 6px 10px;
      font-size: 8pt;
      background: #fff;
      line-height: 1.4;
      margin-bottom: 15px;
    }
    .sig-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 35px;
      font-size: 8.5pt;
    }
    .sig-table td {
      width: 50%;
      vertical-align: bottom;
    }
  </style>
</head>
<body>

  <!-- Header -->
  <table class="header-table">
    <tr>
      <td style="width: 60%;">
        <div class="company-title">Petro Valves Pvt. Ltd.</div>
        <div class="company-sub">Plot No. 12/B, Kuha GIDC, Tal. Daskroi, Dist. Ahmedabad - 382433, Gujarat, India</div>
        <div class="company-sub">Email: accounts@petrovalves.co.in | GSTIN: 24AABCP1234F1ZQ | PAN: AABCP1234F</div>
      </td>
      <td style="width: 40%; text-align: right; vertical-align: top;">
        <div class="pi-title-badge">PROFORMA INVOICE</div>
        <div style="font-size: 8.5pt; color: #047857; font-weight: 700; margin-top: 3px;">(10% ADVANCE PAYMENT)</div>
      </td>
    </tr>
  </table>

  <!-- Meta Info -->
  <table class="meta-box">
    <tr>
      <td style="width: 50%;">
        <span class="lbl">Proforma Invoice No:</span> <strong>${pi.piNumber}</strong><br>
        <span class="lbl">Date:</span> <strong>${formatDate(pi.piDate)}</strong><br>
        <span class="lbl">Order Acceptance Ref:</span> ${oa.oaNumber || '-'}<br>
        <span class="lbl">Customer PO No:</span> <strong>${pi.customerPoNumber}</strong><br>
        <span class="lbl">Customer PO Date:</span> ${formatDate(pi.customerPoDate)}
      </td>
      <td style="width: 50%;">
        <span class="lbl">Bill To / Consignee:</span><br>
        <strong>${customer.companyName || 'Valued Customer'}</strong><br>
        ${customer.billingAddress?.street || ''} ${customer.billingAddress?.city || ''} ${customer.billingAddress?.state || ''}<br>
        <span class="lbl">GSTIN:</span> <strong>${customer.gstNumber || '-'}</strong><br>
        <span class="lbl">Contact Person:</span> ${customer.primaryContactName || '-'}<br>
        <span class="lbl">Email:</span> ${customer.emailAddress || '-'}
      </td>
    </tr>
  </table>

  <!-- Items Breakdown -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 6%;">Sr</th>
        <th style="width: 48%;">Description of Goods / Advance Purpose</th>
        <th style="width: 14%;">Rate / Terms</th>
        <th style="width: 14%;">Total Order Value</th>
        <th style="width: 18%;">Advance Amount (INR)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="text-align: center;">1</td>
        <td>
          <strong>10% Mobilization / Production Advance</strong><br>
          <span style="color: #444; font-size: 8pt;">
            Against Customer PO No. <strong>${pi.customerPoNumber}</strong> dated ${formatDate(pi.customerPoDate)} 
            for supply of Industrial Valves as per Order Acceptance <strong>${oa.oaNumber || '-'}</strong>.
          </span>
        </td>
        <td style="text-align: center;"><strong>${pi.advancePercentage}% Advance</strong></td>
        <td class="right">${formatCurrency(pi.totalOrderValue)}</td>
        <td class="right"><strong>${formatCurrency(pi.advanceAmount)}</strong></td>
      </tr>
      <tr class="tot-row">
        <td colspan="4" class="right"><strong>Taxable Advance Value:</strong></td>
        <td class="right"><strong>${formatCurrency(pi.advanceAmount)}</strong></td>
      </tr>
      <tr>
        <td colspan="4" class="right">Add: GST (${pi.gstRate}%):</td>
        <td class="right">${formatCurrency(pi.gstAmount)}</td>
      </tr>
      <tr class="tot-row" style="background: #eef7f2;">
        <td colspan="4" class="right" style="color: #047857; font-size: 9.5pt;"><strong>Net Total Advance Payable:</strong></td>
        <td class="right" style="color: #047857; font-size: 10pt;"><strong>${formatCurrency(pi.grandTotal)}</strong></td>
      </tr>
    </tbody>
  </table>

  <!-- Amount in Words -->
  <div style="margin-bottom: 12px; font-size: 8.5pt;">
    <strong>Amount in Words:</strong> <em>${inWords(pi.grandTotal)}</em>
  </div>

  <!-- Bank Details for RTGS/NEFT -->
  <div class="bank-box">
    <div class="bank-title">Bank Details for Direct RTGS / NEFT / IMPS Remittance:</div>
    <table style="width: 100%; border-collapse: collapse; font-size: 8.5pt;">
      <tr>
        <td style="width: 25%; font-weight: 700;">Account Name:</td>
        <td style="width: 25%;">${pi.bankDetails?.accountName || 'PETRO VALVES PVT. LTD.'}</td>
        <td style="width: 25%; font-weight: 700;">Bank Name:</td>
        <td style="width: 25%;">${pi.bankDetails?.bankName || 'HDFC BANK LTD'}</td>
      </tr>
      <tr>
        <td style="font-weight: 700;">Account Number:</td>
        <td><strong style="color: #0b3b60; font-size: 9.5pt;">${pi.bankDetails?.accountNumber || '50200012345678'}</strong></td>
        <td style="font-weight: 700;">IFSC Code:</td>
        <td><strong style="color: #0b3b60; font-size: 9.5pt;">${pi.bankDetails?.ifscCode || 'HDFC0000240'}</strong></td>
      </tr>
      <tr>
        <td style="font-weight: 700;">Branch:</td>
        <td colspan="3">${pi.bankDetails?.branch || 'KUHA, AHMEDABAD'}</td>
      </tr>
    </table>
  </div>

  <!-- Terms & Instructions -->
  <div class="terms-box">
    <strong>Terms & Instructions:</strong><br>
    1. This Proforma Invoice is issued exclusively for claiming the mandatory <strong>10% Advance</strong> as per purchase contract.<br>
    2. Please quote our Proforma Invoice No. (<strong>${pi.piNumber}</strong>) while remitting payment via RTGS/NEFT.<br>
    3. Kindly share the Bank UTR / Payment Advice to <strong>accounts@petrovalves.co.in</strong> immediately upon remittance.<br>
    4. GAD & QAP submittals and manufacturing release will be initiated upon confirmation of advance credit in our bank account.
  </div>

  <!-- Signatures -->
  <table class="sig-table">
    <tr>
      <td>
        <span style="font-size: 8pt; color: #666;">Prepared By: Finance & Commercial</span>
      </td>
      <td style="text-align: right;">
        <strong>For, Petro Valves Pvt. Ltd.</strong><br><br><br>
        <span>Authorized Signatory</span>
      </td>
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
      margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' }
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = {
  generateCustomerProformaInvoicePdf
};

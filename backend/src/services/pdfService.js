const puppeteer = require('puppeteer');

exports.generateQuotationPdf = async (quotation) => {
  // Defensive checks
  const customer = quotation.customer || {};
  const items = quotation.items || [];
  const totals = quotation.commercialTotals || { subtotal: 0, estimatedTax: 0, grandTotal: 0 };

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 40px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 20px; mb-4; }
        .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
        .company-details { text-align: right; font-size: 12px; color: #555; }
        .quotation-title { text-align: center; font-size: 20px; font-weight: bold; margin: 20px 0; text-transform: uppercase; letter-spacing: 2px; }
        .info-grid { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 13px; }
        .info-box { width: 48%; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
        .info-box h4 { margin: 0 0 10px 0; font-size: 11px; color: #64748b; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; }
        th { background: #2563eb; color: white; padding: 12px; text-align: left; font-size: 11px; text-transform: uppercase; }
        td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
        .totals { width: 40%; margin-left: auto; font-size: 13px; }
        .totals-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
        .totals-row.bold { font-weight: bold; font-size: 16px; color: #2563eb; border-top: 2px solid #e2e8f0; border-bottom: none; padding-top: 12px; margin-top: 5px; }
        .footer { margin-top: 50px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">PETRO VALVE</div>
        <div class="company-details">
          123 Industrial Estate, Phase II<br>
          Mumbai, Maharashtra 400001<br>
          sales@petrovalve.com | +91 98765 43210
        </div>
      </div>

      <div class="quotation-title">Official Quotation</div>

      <div class="info-grid">
        <div class="info-box">
          <h4>Prepared For</h4>
          <strong>${customer.companyName || 'N/A'}</strong><br>
          Attn: ${customer.primaryContactName || 'N/A'}<br>
          Email: ${customer.emailAddress || 'N/A'}<br>
          City: ${customer.city || 'N/A'}<br>
          GSTIN: ${customer.gstin || 'N/A'}
        </div>
        <div class="info-box">
          <h4>Quotation Details</h4>
          <strong>Quote No:</strong> ${quotation.quotationId}<br>
          <strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}<br>
          <strong>Valid Until:</strong> ${quotation.validityDays ? new Date(Date.now() + quotation.validityDays * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN') : '30 Days'}<br>
          <strong>Prepared By:</strong> ${quotation.preparedBy?.fullName || 'Sales Team'}<br>
          <strong>Status:</strong> ${quotation.status}
        </div>
      </div>

      <div style="margin-bottom: 20px; font-size: 13px;">
        <strong>Scope of Supply:</strong> <br>
        <i>${quotation.scopeOfSupply || 'As per attached detailed specifications'}</i>
      </div>

      <table>
        <thead>
          <tr>
            <th>SR</th>
            <th>Description</th>
            <th style="text-align: right;">Qty</th>
            <th style="text-align: right;">Unit Price (INR)</th>
            <th style="text-align: right;">Total (INR)</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${item.description}</td>
              <td style="text-align: right;">${item.quantity || 1}</td>
              <td style="text-align: right;">${(item.unitPrice || 0).toLocaleString('en-IN')}</td>
              <td style="text-align: right;">${(item.lineTotalExclGST || 0).toLocaleString('en-IN')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-row">
          <span>Subtotal (Excl. GST)</span>
          <span>₹${(totals.subtotal || totals.grandTotal || 0).toLocaleString('en-IN')}</span>
        </div>
        <div class="totals-row">
          <span>Estimated GST (18%)</span>
          <span>₹${(totals.estimatedTax || ((totals.grandTotal || 0) * 0.18)).toLocaleString('en-IN')}</span>
        </div>
        <div class="totals-row bold">
          <span>Grand Total</span>
          <span>₹${((totals.grandTotal || 0) * 1.18).toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div style="margin-top: 40px; font-size: 12px; line-height: 1.6;">
        <strong>Terms & Conditions:</strong><br>
        1. <strong>Payment:</strong> 40% Advance, 60% against Proforma Invoice before dispatch.<br>
        2. <strong>Delivery:</strong> Normally 6-8 weeks from drawing approval.<br>
        3. <strong>Validity:</strong> 30 days from date of quotation.<br>
        4. <strong>Jurisdiction:</strong> Subject to local jurisdiction laws.
      </div>

      <div class="footer">
        This is a system generated document. No physical signature is required.<br>
        Petro Valve Workflow Automation System | Document Ref: ${quotation.quotationId}
      </div>
    </body>
    </html>
  `;

  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
  });

  await browser.close();
  return pdfBuffer;
};

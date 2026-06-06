const puppeteer = require('puppeteer');

exports.generateQuotationPdf = async (quotation) => {
  const customer = quotation.customer || {};
  const items = quotation.items || [];
  
  // Calculate pricing breakdown on the fly for display
  let calculatedSubtotal = 0;
  const pricedItems = items.map((item, idx) => {
    const unitPrice = item.unitPrice || 0;
    const ndt = item.ndtCharges || 0;
    const specTest = item.specialTestingCharges || 0;
    const spares = item.sparesCharges || 0;
    const cert32 = item.cert32Charges || 0;
    const pf = item.pfCharges || 0;
    const tpi = item.tpiCharges || 0;
    const discount = item.discountPercent || 0;

    const unitRateBeforeDiscount = unitPrice + ndt + specTest + spares + cert32 + pf + tpi;
    const unitRate = unitRateBeforeDiscount * (1 - discount / 100);
    const lineTotal = unitRate * (item.quantity || 1);
    calculatedSubtotal += lineTotal;

    return {
      sr: idx + 1,
      description: item.description || '',
      qty: item.quantity || 1,
      unit: item.unit || 'NOS',
      unitPrice,
      ndt,
      specTest,
      spares,
      cert32,
      pf,
      tpi,
      unitRate,
      lineTotal
    };
  });

  const subtotalExclGST = calculatedSubtotal;
  const gstAmount = subtotalExclGST * 0.18;
  const grandTotal = subtotalExclGST + gstAmount;

  // Extract unique item specification properties for the Checklist table
  // Properties mapped to display labels
  const specFields = [
    { key: 'valve_type', label: 'Valve Type' },
    { key: 'valve_size', label: 'Size (DN)', suffix: ' mm' },
    { key: 'valve_class', label: 'Pressure Class' },
    { key: 'valve_api6d_monogram', label: 'API 6D Monogram Required' },
    { key: 'valve_qsl_level', label: 'Quality Specification Level' },
    { key: 'valve_design_type', label: 'Design Type' },
    { key: 'valve_bore', label: 'Bore' },
    { key: 'valve_end_connection', label: 'End Type' },
    { key: 'valve_operating', label: 'Operating of Valves' },
    { key: 'valve_ball_type', label: 'Ball/Disc Type' },
    { key: 'valve_direction', label: 'Direction' },
    { key: 'valve_service', label: 'Service' },
    { key: 'valve_seat_type', label: 'Seat Type' },
    { key: 'valve_design_std', label: 'Valve Design Standard' },
    { key: 'valve_testing_std', label: 'Valve Testing Standard' },
    { key: 'valve_min_design_temp', label: 'Min Design Temp' },
    { key: 'valve_max_design_temp', label: 'Max Design Temp' },
    { key: 'valve_drain_conn_size', label: 'Drain Connection Size' },
    { key: 'valve_vent_conn_size', label: 'Vent Connection Size' },
    { key: 'valve_lifting_lug', label: 'Lifting Lug' },
    { key: 'valve_support_foot', label: 'Support Foot Required' },
    { key: 'valve_fire_safe', label: 'Fire Safe Design' },
    { key: 'valve_antistatic', label: 'Antistatic Device' },
    { key: 'valve_locking_device', label: 'Locking Device' },
    { key: 'valve_for_pigging', label: 'Is Valve For Pigging' },
    { key: 'valve_prv', label: 'Pressure Relief Valve' },
    { key: 'valve_cavity_relief', label: 'Cavity Relief Valve' },
    { key: 'valve_bypass', label: 'By-Pass Connection' },
    { key: 'valve_corrosion_allowance', label: 'Corrosion Allowance' },
    { key: 'valve_moc_body', label: 'Body/Bonnet Material' },
    { key: 'valve_moc_ball', label: 'Ball/Wedge/Disc Material' },
    { key: 'valve_moc_stem', label: 'Stem/Hinge Material' },
    { key: 'valve_moc_seat', label: 'Seat Ring/Holder Material' },
    { key: 'valve_moc_stud_nuts', label: 'Stud & Nuts Material' }
  ];

  // Build specifications matrix
  const columnsCount = items.length;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Quotation ${quotation.quotationId}</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 40px; font-size: 13px; line-height: 1.5; }
        .page { page-break-after: always; padding-bottom: 20px; }
        .page:last-child { page-break-after: avoid; }
        
        /* Corporate Header Styling */
        .pdf-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1e3a8a; padding-bottom: 15px; margin-bottom: 30px; }
        .company-brand { font-size: 28px; font-weight: 800; color: #1e3a8a; letter-spacing: 1px; }
        .company-meta { text-align: right; font-size: 11px; color: #64748b; line-height: 1.4; }
        
        .part-title { font-size: 18px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 20px; letter-spacing: 0.5px; }
        
        /* Metadata card grid */
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        .meta-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
        .meta-card h3 { margin: 0 0 10px 0; font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 1px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 5px; }
        .meta-card p { margin: 4px 0; font-size: 12.5px; }
        
        .intro-text { font-size: 13.5px; line-height: 1.6; margin-bottom: 25px; color: #334155; }
        
        /* Tables styling */
        table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; }
        table.data-table th { background: #1e3a8a; color: white; font-weight: 700; text-transform: uppercase; font-size: 11px; padding: 10px 12px; border: 1px solid #1e3a8a; text-align: left; }
        table.data-table td { padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 12px; vertical-align: middle; }
        table.data-table tr:nth-child(even) { background: #f8fafc; }
        
        /* Checklist specific table style (Side-by-side spec comparison) */
        table.checklist-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #cbd5e1; }
        table.checklist-table th, table.checklist-table td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 11.5px; }
        table.checklist-table th { background: #1e3a8a; color: white; text-align: left; text-transform: uppercase; font-size: 10px; }
        table.checklist-table td.prop-name { font-weight: 700; color: #334155; width: 220px; background: #f1f5f9; }
        table.checklist-table td.spec-val { text-align: center; }

        /* Price summary block */
        .summary-wrapper { display: flex; justify-content: flex-end; margin-top: 20px; }
        .price-summary { width: 320px; background: #f8fafc; border: 1.5px solid #1e3a8a; border-radius: 12px; padding: 16px; }
        .summary-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0; font-size: 12.5px; }
        .summary-row:last-child { border-bottom: none; }
        .summary-row.total-row { font-weight: 800; font-size: 15px; color: #1e3a8a; border-top: 2px solid #1e3a8a; padding-top: 10px; margin-top: 5px; }
        
        /* Terms list */
        .terms-list { display: flex; flex-direction: column; gap: 12px; margin-top: 15px; }
        .term-item { display: flex; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
        .term-label { width: 180px; font-weight: bold; color: #1e3a8a; font-size: 12.5px; flex-shrink: 0; }
        .term-value { color: #334155; font-size: 12.5px; line-height: 1.4; }

        .pdf-footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 10.5px; color: #94a3b8; }
        
        .badge { display: inline-block; padding: 2px 6px; font-size: 9px; font-weight: bold; border-radius: 4px; text-transform: uppercase; }
        .badge-info { background: #e0f2fe; color: #0369a1; }
      </style>
    </head>
    <body>

      <!-- PAGE 1: TECHNICAL PART - I -->
      <div class="page">
        <div class="pdf-header">
          <div class="company-brand">PETRO VALVE</div>
          <div class="company-meta">
            <strong>PETRO VALVES PVT. LTD.</strong><br>
            Plot No. 456, Phase IV, GIDC Industrial Estate,<br>
            Vatva, Ahmedabad, Gujarat 382445<br>
            sales@petrovalves.co.in | +91 79 2583 0000
          </div>
        </div>

        <div class="part-title">Technical Part - I</div>

        <div class="meta-grid">
          <div class="meta-card">
            <h3>Prepared For</h3>
            <p><strong>Company:</strong> ${customer.companyName || 'N/A'}</p>
            <p><strong>Contact:</strong> ${customer.primaryContactName || 'N/A'}</p>
            <p><strong>Designation:</strong> ${customer.designation || 'N/A'}</p>
            <p><strong>Email:</strong> ${customer.emailAddress || 'N/A'}</p>
            <p><strong>Mobile:</strong> ${customer.mobileNumber || 'N/A'}</p>
          </div>
          <div class="meta-card">
            <h3>Offer Details</h3>
            <p><strong>Offer No:</strong> ${quotation.quotationId}</p>
            <p><strong>Date:</strong> ${new Date(quotation.createdAt).toLocaleDateString('en-IN')}</p>
            <p><strong>Project:</strong> ${quotation.enquiry?.project || 'N/A'}</p>
            <p><strong>Enquiry Ref:</strong> ${quotation.enquiry?.enquiryId || 'N/A'}</p>
            <p><strong>Revision:</strong> Rev ${quotation.revisionNumber || 0}</p>
          </div>
        </div>

        <div class="intro-text">
          Dear Sir/Madam,<br><br>
          We acknowledge with thanks the receipt of your valued enquiry reference above. We are pleased to submit our most competitive Techno-Commercial Offer for the supply of Industrial Valves as per the technical specifications, data sheets, and commercial parameters detailed in the following sections of this proposal.
        </div>

        <div class="part-title" style="font-size: 14px; margin-top: 30px;">General Technical Details</div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 40%;">Parameter</th>
              <th style="width: 60%;">Details / Conformance Statement</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Manufacturer Name</strong></td>
              <td>${quotation.manufacturerName || 'M/s. PETRO VALVES PVT LTD'}</td>
            </tr>
            <tr>
              <td><strong>Origin of Goods</strong></td>
              <td>${quotation.originOfGoods || 'INDIA'}</td>
            </tr>
            <tr>
              <td><strong>Scope of Supply</strong></td>
              <td>${quotation.scopeOfSupply || 'As per attached detailed specifications'}</td>
            </tr>
            <tr>
              <td><strong>Estimated Weight & Dimensions</strong></td>
              <td>${quotation.weightDimensions || 'This details given at the time of dispatch'}</td>
            </tr>
            <tr>
              <td><strong>Technical Documents & Drawings</strong></td>
              <td>${quotation.technicalDocuments || 'This is share after receiving of techno-commercial order'}</td>
            </tr>
            <tr>
              <td><strong>Delivery Basis</strong></td>
              <td>${quotation.deliveryTimeHeader || 'Provided in COMMERCIAL PART - III'}</td>
            </tr>
            <tr>
              <td><strong>Goods Quality Statement</strong></td>
              <td>Are the goods new, unused, and manufactured as per latest standards? <strong>Yes, brand new.</strong></td>
            </tr>
          </tbody>
        </table>

        <div class="pdf-footer">
          Petro Valve Techno-Commercial Offer | Ref: ${quotation.quotationId} | Page 1 of 4
        </div>
      </div>

      <!-- PAGE 2: CONTRACT REVIEW CHECKLIST -->
      <div class="page">
        <div class="pdf-header">
          <div class="company-brand">PETRO VALVE</div>
          <div class="company-meta">
            <strong>Offer No:</strong> ${quotation.quotationId}<br>
            <strong>Date:</strong> ${new Date(quotation.createdAt).toLocaleDateString('en-IN')}
          </div>
        </div>

        <div class="part-title">Contract Review Checklist (Technical Specifications)</div>
        <div style="margin-bottom: 15px; font-style: italic; color: #475569;">
          Below is the consolidated specification sheet mapping out the parameters for each quoted item:
        </div>

        <table class="checklist-table">
          <thead>
            <tr>
              <th>Specification Parameter</th>
              ${items.map(item => `
                <th style="text-align: center;">Item ${item.itemNo}</th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            <!-- Core Specs -->
            <tr>
              <td class="prop-name">Item Description</td>
              ${items.map(item => `
                <td style="font-weight: bold; font-size: 10px;">${item.description || 'N/A'}</td>
              `).join('')}
            </tr>
            <tr>
              <td class="prop-name">Product Category</td>
              ${items.map(item => `
                <td style="text-align: center;">${item.productCategory || 'N/A'}</td>
              `).join('')}
            </tr>
            <tr>
              <td class="prop-name">Material Grade (MOC)</td>
              ${items.map(item => `
                <td style="text-align: center; font-weight: bold;">${item.materialGrade || 'N/A'}</td>
              `).join('')}
            </tr>
            <tr>
              <td class="prop-name">Applicable Standard</td>
              ${items.map(item => `
                <td style="text-align: center;">${item.applicableStandard || 'N/A'}</td>
              `).join('')}
            </tr>
            
            <!-- Dynamic Specs from checklist -->
            ${specFields.map(field => {
              // Only display the row if at least one item has a value for it
              const hasAnyVal = items.some(item => item.dynamicFields && item.dynamicFields[field.key] !== undefined && item.dynamicFields[field.key] !== '');
              if (!hasAnyVal) return '';

              return `
                <tr>
                  <td class="prop-name">${field.label}</td>
                  ${items.map(item => {
                    const val = item.dynamicFields?.[field.key] || 'NO';
                    const displayVal = val === 'NO' ? '-' : val + (field.suffix || '');
                    return `<td class="spec-val">${displayVal}</td>`;
                  }).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="pdf-footer">
          Petro Valve Techno-Commercial Offer | Ref: ${quotation.quotationId} | Page 2 of 4
        </div>
      </div>

      <!-- PAGE 3: PRICE PART - II -->
      <div class="page">
        <div class="pdf-header">
          <div class="company-brand">PETRO VALVE</div>
          <div class="company-meta">
            <strong>Offer No:</strong> ${quotation.quotationId}<br>
            <strong>Date:</strong> ${new Date(quotation.createdAt).toLocaleDateString('en-IN')}
          </div>
        </div>

        <div class="part-title">Price Part - II</div>
        
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">Sr</th>
              <th style="width: 35%;">Item Description</th>
              <th style="width: 8%; text-align: right;">Qty</th>
              <th style="width: 12%; text-align: right;">Base Price</th>
              <th style="width: 10%; text-align: right;">NDT Chg</th>
              <th style="width: 10%; text-align: right;">Testing</th>
              <th style="width: 10%; text-align: right;">Spares</th>
              <th style="width: 10%; text-align: right;">Unit Rate</th>
              <th style="width: 12%; text-align: right;">Total (INR)</th>
            </tr>
          </thead>
          <tbody>
            ${pricedItems.map(item => `
              <tr>
                <td style="text-align: center;">${item.sr}</td>
                <td>
                  <strong>${item.description}</strong><br>
                  <span style="font-size: 10px; color: #64748b;">MOC: ${items[item.sr-1].materialGrade || 'N/A'}</span>
                </td>
                <td style="text-align: right; font-weight: bold;">${item.qty}</td>
                <td style="text-align: right;">₹${item.unitPrice.toLocaleString('en-IN')}</td>
                <td style="text-align: right;">₹${item.ndt.toLocaleString('en-IN')}</td>
                <td style="text-align: right;">₹${item.specTest.toLocaleString('en-IN')}</td>
                <td style="text-align: right;">₹${item.spares.toLocaleString('en-IN')}</td>
                <td style="text-align: right; font-weight: bold;">₹${Math.round(item.unitRate).toLocaleString('en-IN')}</td>
                <td style="text-align: right; font-weight: 800; color: #1e3a8a;">₹${Math.round(item.lineTotal).toLocaleString('en-IN')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="summary-wrapper">
          <div class="price-summary">
            <div class="summary-row">
              <span>Subtotal (Excl. GST)</span>
              <strong>₹${Math.round(subtotalExclGST).toLocaleString('en-IN')}</strong>
            </div>
            <div class="summary-row">
              <span>CGST + SGST (18%)</span>
              <span>₹${Math.round(gstAmount).toLocaleString('en-IN')}</span>
            </div>
            <div class="summary-row total-row">
              <span>Grand Total</span>
              <span>₹${Math.round(grandTotal).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        <div class="pdf-footer" style="margin-top: 80px;">
          Petro Valve Techno-Commercial Offer | Ref: ${quotation.quotationId} | Page 3 of 4
        </div>
      </div>

      <!-- PAGE 4: COMMERCIAL PART - III -->
      <div class="page">
        <div class="pdf-header">
          <div class="company-brand">PETRO VALVE</div>
          <div class="company-meta">
            <strong>Offer No:</strong> ${quotation.quotationId}<br>
            <strong>Date:</strong> ${new Date(quotation.createdAt).toLocaleDateString('en-IN')}
          </div>
        </div>

        <div class="part-title">Commercial Part - III (Terms & Conditions)</div>

        <div class="terms-list">
          <div class="term-item">
            <div class="term-label">1. Prices Basis</div>
            <div class="term-value">${quotation.priceBasis || 'Ex Works Ahmedabad.'}</div>
          </div>
          <div class="term-item">
            <div class="term-label">2. Packing & Forwarding</div>
            <div class="term-value">${quotation.packingForwardingTerms || 'Extra as given in Price Part - II.'}</div>
          </div>
          <div class="term-item">
            <div class="term-label">3. Freight</div>
            <div class="term-value">${quotation.freightTerms || 'Extra at actual to your account.'}</div>
          </div>
          <div class="term-item">
            <div class="term-label">4. Tax & Duty</div>
            <div class="term-value">${quotation.taxDutyTerms || 'Extra at actual to your account (18% GST default)'}</div>
          </div>
          <div class="term-item">
            <div class="term-label">5. Terms of Payment</div>
            <div class="term-value">${quotation.paymentTerms || '10% Advance along with PO & balance payment 90% against Proforma Invoice before dispatch.'}</div>
          </div>
          <div class="term-item">
            <div class="term-label">6. Validity</div>
            <div class="term-value">${quotation.validityTerms || 'Three Month from the date of Quote'}</div>
          </div>
          <div class="term-item">
            <div class="term-label">7. Third Party Inspection</div>
            <div class="term-value">${quotation.tpiTerms || 'We will offer valves to your nominated TPIA agency. Charges towards TPIA fees will be to your account.'}</div>
          </div>
          <div class="term-item">
            <div class="term-label">8. Delivery Period</div>
            <div class="term-value">${quotation.deliverySchedule || '16 weeks from the date of technical document approvals and advance receipt.'}</div>
          </div>
          <div class="term-item">
            <div class="term-label">9. Transit Insurance</div>
            <div class="term-value">${quotation.transitInsurance || 'In your scope only.'}</div>
          </div>
          <div class="term-item">
            <div class="term-label">10. Guarantee / Warranty</div>
            <div class="term-value">${quotation.guaranteeTerms || '12 months from the date of commissioning or 18 months from the date of dispatch, whichever is earlier.'}</div>
          </div>
        </div>

        <div style="margin-top: 40px; padding: 15px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; font-size: 11px; color: #b45309;">
          <strong>Order Modification / Cancellation Policy:</strong><br>
          • After order acknowledgement: 30% surcharge applied.<br>
          • After Manufacturing clearance: 50% surcharge applied.<br>
          • After receipt of Raw Material: 100% surcharge applied.
        </div>

        <div class="pdf-footer" style="margin-top: 50px;">
          Petro Valve Techno-Commercial Offer | Ref: ${quotation.quotationId} | Page 4 of 4
        </div>
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

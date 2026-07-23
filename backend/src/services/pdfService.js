const puppeteer = require('puppeteer');

exports.generateQuotationPdf = async (quotation) => {
  const customer = quotation.customer || {};
  const items = quotation.items || [];
  const enquiry = quotation.enquiry || {};

  // Customer & Project Metadata Resolution
  const senderCompany = quotation.senderCompany || enquiry.senderCompany || customer.companyName || 'N/A';
  const clientName = quotation.clientName || enquiry.clientName || 'N/A';
  const pmcConsultant = quotation.pmcConsultant || enquiry.pmcConsultant || 'N/A';
  const contactPerson = quotation.contactPerson || customer.primaryContactName || enquiry.contactPerson || 'N/A';
  const contactEmail = quotation.contactEmail || customer.emailAddress || enquiry.contactEmail || 'N/A';
  const contactMobile = quotation.contactMobile || customer.mobileNumber || enquiry.contactMobile || 'N/A';

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
      category: item.productCategory || enquiry.productCategory || 'Valves',
      qty: item.quantity || 1,
      unit: item.unit || 'NOS',
      materialGrade: item.materialGrade || item.dynamicFields?.valve_moc_body?.value || item.dynamicFields?.valve_moc_body || 'As per specification',
      standardCode: item.applicableStandard || item.standardCode || enquiry.standardCode || 'ASME / API / BS',
      unitPrice,
      ndt,
      specTest,
      spares,
      cert32,
      pf,
      tpi,
      unitRate,
      lineTotal,
      dynamicFields: item.dynamicFields || {}
    };
  });

  const subtotalExclGST = calculatedSubtotal;
  const gstAmount = subtotalExclGST * 0.18;
  const grandTotal = subtotalExclGST + gstAmount;

  // Technical Specification Fields mapped to display labels
  const specFields = [
    { key: 'valve_type', label: 'Valve Type' },
    { key: 'valve_size', label: 'Size (DN)', suffix: ' mm' },
    { key: 'valve_class', label: 'Pressure Class' },
    { key: 'valve_api6d_monogram', label: 'API 6D Monogram Required' },
    { key: 'valve_qsl_level', label: 'Quality Level (QSL)' },
    { key: 'valve_design_type', label: 'Design Type' },
    { key: 'valve_bore', label: 'Bore Type' },
    { key: 'valve_end_connection', label: 'End Connection' },
    { key: 'valve_operating', label: 'Operation / Actuation' },
    { key: 'valve_ball_type', label: 'Ball / Disc Type' },
    { key: 'valve_direction', label: 'Flow Direction' },
    { key: 'valve_service', label: 'Service Fluid' },
    { key: 'valve_seat_type', label: 'Seat Design' },
    { key: 'valve_design_std', label: 'Design Standard' },
    { key: 'valve_testing_std', label: 'Testing Standard' },
    { key: 'valve_min_design_temp', label: 'Min Design Temp' },
    { key: 'valve_max_design_temp', label: 'Max Design Temp' },
    { key: 'valve_fire_safe', label: 'Fire Safe Design' },
    { key: 'valve_antistatic', label: 'Antistatic Device' },
    { key: 'valve_locking_device', label: 'Locking Device' },
    { key: 'valve_corrosion_allowance', label: 'Corrosion Allowance' },
    { key: 'valve_moc_body', label: 'Body / Bonnet Material' },
    { key: 'valve_moc_ball', label: 'Ball / Disc Material' },
    { key: 'valve_moc_stem', label: 'Stem Material' },
    { key: 'valve_moc_seat', label: 'Seat Material' },
    { key: 'valve_moc_stud_nuts', label: 'Fasteners (Stud & Nuts)' }
  ];

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Quotation ${quotation.quotationId}</title>
      <style>
        @page { size: A4; margin: 35px 25px 45px 25px; }
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 12px; line-height: 1.5; background: #ffffff; }
        
        .page { page-break-after: always; padding: 10px 0; }
        .page:last-child { page-break-after: avoid; }
        
        /* Header Styling */
        .pdf-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 20px; }
        .brand-container { display: flex; flex-direction: column; }
        .company-brand { font-size: 26px; font-weight: 900; color: #1e3a8a; letter-spacing: 1.5px; line-height: 1; }
        .company-subbrand { font-size: 9.5px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
        .company-meta { text-align: right; font-size: 10.5px; color: #475569; line-height: 1.4; }
        
        .part-title { font-size: 16px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 16px; letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center; }
        .part-title-badge { font-size: 10px; font-weight: 700; background: #eff6ff; color: #1e40af; padding: 3px 8px; border-radius: 4px; border: 1px solid #bfdbfe; text-transform: none; }
        
        /* Metadata card grid */
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
        .meta-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; }
        .meta-card h3 { margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; color: #1e3a8a; letter-spacing: 1px; font-weight: 800; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px; }
        .meta-card p { margin: 3px 0; font-size: 11.5px; color: #334155; }
        
        .intro-text { font-size: 12.5px; line-height: 1.6; margin-bottom: 20px; color: #334155; background: #f1f5f9; padding: 12px 16px; border-radius: 8px; border-left: 4px solid #1e3a8a; }
        
        /* Tables styling */
        table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; border-radius: 6px; overflow: hidden; border: 1px solid #cbd5e1; }
        table.data-table th { background: #1e3a8a; color: #ffffff; font-weight: 700; text-transform: uppercase; font-size: 10.5px; padding: 9px 10px; border: 1px solid #1e3a8a; text-align: left; }
        table.data-table td { padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 11.5px; vertical-align: middle; color: #1e293b; }
        table.data-table tr:nth-child(even) { background: #f8fafc; }
        
        /* Spec Comparison Table */
        table.checklist-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; border: 1px solid #cbd5e1; }
        table.checklist-table th, table.checklist-table td { border: 1px solid #cbd5e1; padding: 7px 9px; font-size: 11px; }
        table.checklist-table th { background: #1e3a8a; color: white; text-align: left; text-transform: uppercase; font-size: 9.5px; }
        table.checklist-table td.prop-name { font-weight: 700; color: #1e293b; width: 200px; background: #f1f5f9; }
        table.checklist-table td.spec-val { text-align: center; font-size: 10.5px; }

        /* Item Data Sheet Cards */
        .item-datasheet { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 16px; overflow: hidden; page-break-inside: avoid; }
        .item-datasheet-header { background: #f1f5f9; border-bottom: 1px solid #cbd5e1; padding: 10px 14px; font-weight: 800; font-size: 12.5px; color: #1e3a8a; display: flex; justify-content: space-between; }
        .item-datasheet-body { padding: 12px 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; font-size: 11px; }
        .item-datasheet-field { display: flex; justify-content: space-between; border-bottom: 1px border-dotted #e2e8f0; padding-bottom: 2px; }
        .item-datasheet-label { color: #64748b; font-weight: 600; }
        .item-datasheet-value { font-weight: 700; color: #0f172a; }

        /* Price summary block */
        .summary-wrapper { display: flex; justify-content: flex-end; margin-top: 15px; }
        .price-summary { width: 320px; background: #f8fafc; border: 1.5px solid #1e3a8a; border-radius: 10px; padding: 14px; }
        .summary-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
        .summary-row:last-child { border-bottom: none; }
        .summary-row.total-row { font-weight: 800; font-size: 14.5px; color: #1e3a8a; border-top: 2px solid #1e3a8a; padding-top: 8px; margin-top: 4px; }
        
        /* Terms list */
        .terms-list { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
        .term-item { display: flex; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; }
        .term-label { width: 170px; font-weight: 700; color: #1e3a8a; font-size: 11.5px; flex-shrink: 0; }
        .term-value { color: #334155; font-size: 11.5px; line-height: 1.4; }

        /* Signatory Box */
        .signatory-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 30px; page-break-inside: avoid; }
        .signatory-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; text-align: center; background: #f8fafc; }
        .signatory-box h4 { margin: 0 0 40px 0; font-size: 11px; text-transform: uppercase; color: #1e3a8a; letter-spacing: 1px; font-weight: 800; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px; }
        .signatory-line { border-top: 1px solid #94a3b8; width: 70%; margin: 0 auto 6px auto; }
        .signatory-name { font-weight: 700; font-size: 11.5px; color: #0f172a; }
        .signatory-title { font-size: 10px; color: #64748b; }
      </style>
    </head>
    <body>

      <!-- PAGE 1: TECHNICAL PART - I (GENERAL PROPOSAL) -->
      <div class="page">
        <div class="pdf-header">
          <div class="brand-container">
            <div class="company-brand">PETRO VALVE</div>
            <div class="company-subbrand">PETRO VALVES PRIVATE LIMITED</div>
          </div>
          <div class="company-meta">
            Plot No. 456, Phase IV, GIDC Industrial Estate,<br>
            Vatva, Ahmedabad, Gujarat 382445, India<br>
            <strong>Email:</strong> sales@petrovalves.co.in | <strong>Web:</strong> www.petrovalves.co.in<br>
            <strong>CIN:</strong> U29100GJ2015PTC082341 | <strong>GSTIN:</strong> 24AAACP1234F1Z9
          </div>
        </div>

        <div class="part-title">
          <span>Technical Part - I</span>
          <span class="part-title-badge">General Technical Proposal</span>
        </div>

        <div class="meta-grid">
          <div class="meta-card">
            <h3>Prepared For (RFQ Sender)</h3>
            <p><strong>Customer Company:</strong> ${senderCompany}</p>
            <p><strong>Contact Person:</strong> ${contactPerson}</p>
            <p><strong>Email Address:</strong> ${contactEmail}</p>
            <p><strong>Mobile Number:</strong> ${contactMobile}</p>
          </div>
          <div class="meta-card">
            <h3>Project & Offer Metadata</h3>
            <p><strong>Quotation Ref No:</strong> ${quotation.quotationId}</p>
            <p><strong>Quotation Date:</strong> ${new Date(quotation.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            <p><strong>End Client / Owner:</strong> ${clientName}</p>
            <p><strong>PMC / Consultant:</strong> ${pmcConsultant}</p>
            <p><strong>Source Enquiry Ref:</strong> ${enquiry.enquiryId || 'N/A'}</p>
            <p><strong>Offer Revision:</strong> Rev ${quotation.revisionNumber || 0}</p>
          </div>
        </div>

        <div class="intro-text">
          <strong>Dear Sir/Madam,</strong><br>
          We acknowledge with thanks the receipt of your valued enquiry reference above. We are pleased to submit our most competitive Techno-Commercial Proposal for the manufacture and supply of Industrial Valves as per the technical specifications, project standards, and commercial parameters detailed across the sections of this quotation proposal.
        </div>

        <div class="part-title" style="font-size: 13.5px; margin-top: 24px;">General Technical Details & Conformance</div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 35%;">Parameter</th>
              <th style="width: 65%;">Details / Conformance Statement</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Manufacturer Name</strong></td>
              <td>${quotation.manufacturerName || 'M/s. PETRO VALVES PVT LTD'}</td>
            </tr>
            <tr>
              <td><strong>Country of Origin</strong></td>
              <td>${quotation.originOfGoods || 'INDIA'}</td>
            </tr>
            <tr>
              <td><strong>Scope of Supply</strong></td>
              <td>${quotation.scopeOfSupply || 'As per detailed item schedule herein'}</td>
            </tr>
            <tr>
              <td><strong>Quality Certification</strong></td>
              <td>ISO 9001:2015, API 6D, API 600, API 607 (Fire Safe), CE/PED Certified</td>
            </tr>
            <tr>
              <td><strong>Estimated Weight & Dimensions</strong></td>
              <td>${quotation.weightDimensions || 'Detailed dimensional drawings provided upon order placement.'}</td>
            </tr>
            <tr>
              <td><strong>Technical Documents & Drawings</strong></td>
              <td>${quotation.technicalDocuments || 'GA drawings, QAP, and MTR provided after PO acceptance.'}</td>
            </tr>
            <tr>
              <td><strong>Delivery Schedule Basis</strong></td>
              <td>${quotation.deliveryTimeHeader || 'As detailed in Commercial Part - III'}</td>
            </tr>
            <tr>
              <td><strong>Manufacturing Statement</strong></td>
              <td>All valves offered are 100% brand new, unused, and tested per API 598 / BS EN 12266-1.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- PAGE 2: CONTRACT REVIEW CHECKLIST (TECHNICAL MATRIX) -->
      <div class="page">
        <div class="pdf-header">
          <div class="brand-container">
            <div class="company-brand">PETRO VALVE</div>
            <div class="company-subbrand">PETRO VALVES PRIVATE LIMITED</div>
          </div>
          <div class="company-meta">
            <strong>Offer No:</strong> ${quotation.quotationId}<br>
            <strong>Date:</strong> ${new Date(quotation.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>

        <div class="part-title">
          <span>Contract Review Checklist</span>
          <span class="part-title-badge">Technical Comparison Matrix</span>
        </div>
        <div style="margin-bottom: 14px; font-style: italic; color: #475569; font-size: 11.5px;">
          Consolidated technical specification matrix mapping engineering parameters for each quoted item:
        </div>

        <table class="checklist-table">
          <thead>
            <tr>
              <th>Specification Parameter</th>
              ${pricedItems.map(item => `
                <th style="text-align: center;">Item ${item.sr}</th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="prop-name">Item Description</td>
              ${pricedItems.map(item => `
                <td style="font-weight: bold; font-size: 10px;">${item.description || 'N/A'}</td>
              `).join('')}
            </tr>
            <tr>
              <td class="prop-name">Product Category</td>
              ${pricedItems.map(item => `
                <td style="text-align: center;">${item.category}</td>
              `).join('')}
            </tr>
            <tr>
              <td class="prop-name">Quantity & Unit</td>
              ${pricedItems.map(item => `
                <td style="text-align: center; font-weight: bold;">${item.qty} ${item.unit}</td>
              `).join('')}
            </tr>
            <tr>
              <td class="prop-name">Material Grade (MOC Body)</td>
              ${pricedItems.map(item => `
                <td style="text-align: center; font-weight: bold;">${item.materialGrade}</td>
              `).join('')}
            </tr>
            <tr>
              <td class="prop-name">Applicable Standard</td>
              ${pricedItems.map(item => `
                <td style="text-align: center;">${item.standardCode}</td>
              `).join('')}
            </tr>
            
            ${specFields.map(field => {
              const hasAnyVal = pricedItems.some(item => item.dynamicFields && item.dynamicFields[field.key] !== undefined && item.dynamicFields[field.key] !== '');
              if (!hasAnyVal) return '';

              return `
                <tr>
                  <td class="prop-name">${field.label}</td>
                  ${pricedItems.map(item => {
                    const val = item.dynamicFields?.[field.key] || 'NO';
                    const displayVal = val === 'NO' ? '-' : val + (field.suffix || '');
                    return `<td class="spec-val">${displayVal}</td>`;
                  }).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- PAGE 3: TECHNICAL DATA SHEETS (PER ITEM ANNEXURE) -->
      <div class="page">
        <div class="pdf-header">
          <div class="brand-container">
            <div class="company-brand">PETRO VALVE</div>
            <div class="company-subbrand">PETRO VALVES PRIVATE LIMITED</div>
          </div>
          <div class="company-meta">
            <strong>Offer No:</strong> ${quotation.quotationId}<br>
            <strong>Date:</strong> ${new Date(quotation.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>

        <div class="part-title">
          <span>Annexure A</span>
          <span class="part-title-badge">Individual Item Data Sheets</span>
        </div>

        ${pricedItems.map(item => `
          <div class="item-datasheet">
            <div class="item-datasheet-header">
              <span>Item ${item.sr}: ${item.description}</span>
              <span>Qty: ${item.qty} ${item.unit}</span>
            </div>
            <div class="item-datasheet-body">
              <div class="item-datasheet-field">
                <span class="item-datasheet-label">Product Category:</span>
                <span class="item-datasheet-value">${item.category}</span>
              </div>
              <div class="item-datasheet-field">
                <span class="item-datasheet-label">Body / Bonnet Material:</span>
                <span class="item-datasheet-value">${item.materialGrade}</span>
              </div>
              <div class="item-datasheet-field">
                <span class="item-datasheet-label">Design Standard:</span>
                <span class="item-datasheet-value">${item.dynamicFields?.valve_design_std || item.standardCode}</span>
              </div>
              <div class="item-datasheet-field">
                <span class="item-datasheet-label">Testing Standard:</span>
                <span class="item-datasheet-value">${item.dynamicFields?.valve_testing_std || 'API 598 / BS EN 12266-1'}</span>
              </div>
              <div class="item-datasheet-field">
                <span class="item-datasheet-label">Pressure Rating:</span>
                <span class="item-datasheet-value">${item.dynamicFields?.valve_class || 'Class 150 / 300 / 600'}</span>
              </div>
              <div class="item-datasheet-field">
                <span class="item-datasheet-label">Size (Nominal):</span>
                <span class="item-datasheet-value">${item.dynamicFields?.valve_size ? item.dynamicFields.valve_size + ' mm' : 'As per desc'}</span>
              </div>
              <div class="item-datasheet-field">
                <span class="item-datasheet-label">End Connection:</span>
                <span class="item-datasheet-value">${item.dynamicFields?.valve_end_connection || 'Flanged / BW / SW'}</span>
              </div>
              <div class="item-datasheet-field">
                <span class="item-datasheet-label">Operation:</span>
                <span class="item-datasheet-value">${item.dynamicFields?.valve_operating || 'Handwheel / Lever / Actuated'}</span>
              </div>
              <div class="item-datasheet-field">
                <span class="item-datasheet-label">Fire Safe Certification:</span>
                <span class="item-datasheet-value">${item.dynamicFields?.valve_fire_safe || 'Yes (API 607)'}</span>
              </div>
              <div class="item-datasheet-field">
                <span class="item-datasheet-label">Inspection & Testing:</span>
                <span class="item-datasheet-value">100% Hydrostatic & Pneumatic Shell/Seat Test</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- PAGE 4: PRICE PART - II (COMMERCIAL PRICE SCHEDULE) -->
      <div class="page">
        <div class="pdf-header">
          <div class="brand-container">
            <div class="company-brand">PETRO VALVE</div>
            <div class="company-subbrand">PETRO VALVES PRIVATE LIMITED</div>
          </div>
          <div class="company-meta">
            <strong>Offer No:</strong> ${quotation.quotationId}<br>
            <strong>Date:</strong> ${new Date(quotation.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>

        <div class="part-title">
          <span>Price Part - II</span>
          <span class="part-title-badge">Commercial Price Schedule</span>
        </div>
        
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 4%; text-align: center;">Sr</th>
              <th style="width: 34%;">Item Description</th>
              <th style="width: 7%; text-align: right;">Qty</th>
              <th style="width: 11%; text-align: right;">Base Price</th>
              <th style="width: 9%; text-align: right;">NDT Chg</th>
              <th style="width: 9%; text-align: right;">Testing</th>
              <th style="width: 9%; text-align: right;">Spares</th>
              <th style="width: 8%; text-align: right;">P&F</th>
              <th style="width: 13%; text-align: right;">Line Total (INR)</th>
            </tr>
          </thead>
          <tbody>
            ${pricedItems.map(item => `
              <tr>
                <td style="text-align: center;">${item.sr}</td>
                <td>
                  <strong>${item.description}</strong><br>
                  <span style="font-size: 10px; color: #475569;">MOC: ${item.materialGrade} | Std: ${item.standardCode}</span>
                </td>
                <td style="text-align: right; font-weight: bold;">${item.qty}</td>
                <td style="text-align: right;">₹${item.unitPrice.toLocaleString('en-IN')}</td>
                <td style="text-align: right;">₹${item.ndt.toLocaleString('en-IN')}</td>
                <td style="text-align: right;">₹${item.specTest.toLocaleString('en-IN')}</td>
                <td style="text-align: right;">₹${item.spares.toLocaleString('en-IN')}</td>
                <td style="text-align: right;">₹${item.pf.toLocaleString('en-IN')}</td>
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
              <span>Grand Total (Incl. GST)</span>
              <span>₹${Math.round(grandTotal).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- PAGE 5: COMMERCIAL PART - III (TERMS & SIGNATORY ACCEPTANCE) -->
      <div class="page">
        <div class="pdf-header">
          <div class="brand-container">
            <div class="company-brand">PETRO VALVE</div>
            <div class="company-subbrand">PETRO VALVES PRIVATE LIMITED</div>
          </div>
          <div class="company-meta">
            <strong>Offer No:</strong> ${quotation.quotationId}<br>
            <strong>Date:</strong> ${new Date(quotation.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>

        <div class="part-title">
          <span>Commercial Part - III</span>
          <span class="part-title-badge">Terms & Conditions</span>
        </div>

        <div class="terms-list">
          <div class="term-item">
            <div class="term-label">1. Prices Basis</div>
            <div class="term-value">${quotation.priceBasis || 'Ex Works Ahmedabad basis.'}</div>
          </div>
          <div class="term-item">
            <div class="term-label">2. Packing & Forwarding</div>
            <div class="term-value">${quotation.packingForwardingTerms || 'Extra as given in Price Part - II.'}</div>
          </div>
          <div class="term-item">
            <div class="term-label">3. Freight Charges</div>
            <div class="term-value">${quotation.freightTerms || 'Extra at actuals to your account.'}</div>
          </div>
          <div class="term-item">
            <div class="term-label">4. Taxes & Duties</div>
            <div class="term-value">${quotation.taxDutyTerms || 'GST 18% extra at actuals.'}</div>
          </div>
          <div class="term-item">
            <div class="term-label">5. Terms of Payment</div>
            <div class="term-value">${quotation.paymentTerms || '10% Advance along with PO & 90% against Proforma Invoice before dispatch.'}</div>
          </div>
          <div class="term-item">
            <div class="term-label">6. Offer Validity</div>
            <div class="term-value">${quotation.validityTerms || '30 days from the date of this quotation.'}</div>
          </div>
          <div class="term-item">
            <div class="term-label">7. Third Party Inspection</div>
            <div class="term-value">${quotation.tpiTerms || 'We will offer valves to your nominated TPIA agency. Charges towards TPIA fees will be to your account.'}</div>
          </div>
          <div class="term-item">
            <div class="term-label">8. Delivery Schedule</div>
            <div class="term-value">${quotation.deliverySchedule || '16 to 18 weeks from document approval and advance receipt.'}</div>
          </div>
          <div class="term-item">
            <div class="term-label">9. Transit Insurance</div>
            <div class="term-value">${quotation.transitInsurance || 'In customer scope only.'}</div>
          </div>
          <div class="term-item">
            <div class="term-label">10. Guarantee / Warranty</div>
            <div class="term-value">${quotation.guaranteeTerms || '12 months from commissioning or 18 months from dispatch, whichever is earlier.'}</div>
          </div>
        </div>

        <div style="margin-top: 24px; padding: 12px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; font-size: 10.5px; color: #b45309;">
          <strong>Order Modification / Cancellation Surcharge Policy:</strong><br>
          • After order acknowledgement: 30% surcharge applied.<br>
          • After Manufacturing clearance / engineering freeze: 50% surcharge applied.<br>
          • After receipt of Raw Material / casting procurement: 100% surcharge applied.
        </div>

        <!-- Authorized Signatory & Client Acceptance Block -->
        <div class="signatory-grid">
          <div class="signatory-box">
            <h4>For PETRO VALVES PVT. LTD.</h4>
            <div class="signatory-line"></div>
            <div class="signatory-name">${quotation.preparedBy?.fullName || 'Authorized Sales Engineer'}</div>
            <div class="signatory-title">Authorized Signatory (Sales & Commercials)</div>
          </div>
          <div class="signatory-box">
            <h4>CUSTOMER ORDER ACCEPTANCE</h4>
            <div class="signatory-line"></div>
            <div class="signatory-name">Signature & Company Seal</div>
            <div class="signatory-title">Authorized Purchaser / Project Lead</div>
          </div>
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
    displayHeaderFooter: true,
    headerTemplate: `<div style="font-size: 8px; font-family: sans-serif; color: #94a3b8; width: 100%; text-align: right; padding-right: 25px;">PETRO VALVES PVT LTD | Techno-Commercial Offer Ref: ${quotation.quotationId}</div>`,
    footerTemplate: `<div style="font-size: 9px; font-family: sans-serif; color: #64748b; width: 100%; display: flex; justify-content: space-between; padding: 0 25px;"><span>Confidential — Commercial Proposal</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    margin: { top: '35px', bottom: '45px', left: '20px', right: '20px' }
  });

  await browser.close();
  return pdfBuffer;
};

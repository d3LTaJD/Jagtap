const { renderHeader } = require('../components/Header');
const { renderOfficialFooter } = require('../components/Footer');
const { formatPdfValue } = require('../dataFormatter');

function renderCommercialPart3(quotation) {
  const priceBasis = formatPdfValue(quotation.priceBasis, 'Ex Works Ahmedabad.');
  const packing = formatPdfValue(quotation.packingForwardingTerms, 'Extra as given in Price Part – II, If required in wooden box packing & NIL for loose Plastic packing.');
  const freight = formatPdfValue(quotation.freightTerms, 'Extra at actual to your account.');
  const taxDuty = formatPdfValue(quotation.taxDutyTerms, 'Extra at actual to your account (18% GST) as given in Price Part – II.');
  const payment = formatPdfValue(quotation.paymentTerms, '10% Advance along with PO & 20% with approved QAP & GAD Balance against Performa Invoice prior to dispatch.');
  const validity = formatPdfValue(quotation.validityTerms, 'Three Month from the date of Quote');
  const tpi = formatPdfValue(quotation.tpiTerms, 'We will offer valves to your nominated TPIA, charges towards TPIA fees will be Extra at actual to your account as given in Price Part – II.');
  const delivery = formatPdfValue(quotation.deliverySchedule, '10 weeks as per EN 10204 3.2 certification from the date of approval of technical documents and advance payment.');
  const certiCharges = formatPdfValue(quotation.certificationChargesTerms, 'Extra as given in Price Part – II for 3.2 Certificates.');
  const insurance = formatPdfValue(quotation.transitInsurance, 'In your scope only.');
  const guarantee = formatPdfValue(quotation.guaranteeTerms, '12 months from the date of commissioning or 18 months from the date of last shipment which ever is earlier.');
  
  let rawNotes = quotation.commercialNotes || 'If RT, UT, PMI, IGC, NACE, Valves or Actuator Spares, Helium & Nitrogen tests required then charges will be extra at actual to your account as given in Price Part – II.\n\nIf API monogram required then price increase of 25% extra at actual.\n\nWe offer valves as per API-6D without any QSL requirements, if required in QSL-2 to 4b price increase upto 15% subject to QSL levels.';
  rawNotes = formatPdfValue(rawNotes);
  const notesParagraphs = rawNotes.split('\n').map(p => p.trim()).filter(Boolean);

  let rawCancellation = quotation.cancellationTerms || '• After order acknowledgement - 30%\n• After Manufacturing clearance - 50%\n• After receipt of Raw material - 100%';
  rawCancellation = formatPdfValue(rawCancellation);
  const cancelLines = rawCancellation.split('\n').map(l => l.trim()).filter(Boolean);

  const jurisdiction = formatPdfValue(quotation.jurisdictionTerms, 'Subject to Ahmedabad Jurisdiction only.');

  const signatoryName = formatPdfValue(quotation.signatoryName, 'Jay Mistry');
  const signatoryDesignation = formatPdfValue(quotation.signatoryDesignation, '(Sales & Projects)');
  const signatoryPhone = formatPdfValue(quotation.signatoryPhone, '9023723212');

  return `
    <div class="pv-page">
      <div class="pv-page-content">
        ${renderHeader()}

        <div class="pv-section-title" style="margin-top: 10px; margin-bottom: 12px;">
          COMMERCIAL PART – III
        </div>

        <table class="pv-comm-table">
          <tr>
            <td class="pv-comm-label">Prices Basis</td>
            <td class="pv-comm-colon">:</td>
            <td class="pv-comm-value">${priceBasis}</td>
          </tr>
          <tr>
            <td class="pv-comm-label">Packing &amp; Forwarding</td>
            <td class="pv-comm-colon">:</td>
            <td class="pv-comm-value">${packing}</td>
          </tr>
          <tr>
            <td class="pv-comm-label">Freight</td>
            <td class="pv-comm-colon">:</td>
            <td class="pv-comm-value">${freight}</td>
          </tr>
          <tr>
            <td class="pv-comm-label">Tax &amp; Duty</td>
            <td class="pv-comm-colon">:</td>
            <td class="pv-comm-value">${taxDuty}</td>
          </tr>
          <tr>
            <td class="pv-comm-label">Terms of Payment</td>
            <td class="pv-comm-colon">:</td>
            <td class="pv-comm-value">${payment}</td>
          </tr>
          <tr>
            <td class="pv-comm-label">Validity</td>
            <td class="pv-comm-colon">:</td>
            <td class="pv-comm-value">${validity}</td>
          </tr>
          <tr>
            <td class="pv-comm-label">Third Party Inspection</td>
            <td class="pv-comm-colon">:</td>
            <td class="pv-comm-value">${tpi}</td>
          </tr>
          <tr>
            <td class="pv-comm-label">Delivery Period</td>
            <td class="pv-comm-colon">:</td>
            <td class="pv-comm-value">${delivery}</td>
          </tr>
          <tr>
            <td class="pv-comm-label">Certification Charges</td>
            <td class="pv-comm-colon">:</td>
            <td class="pv-comm-value">${certiCharges}</td>
          </tr>
          <tr>
            <td class="pv-comm-label">Transit Insurance</td>
            <td class="pv-comm-colon">:</td>
            <td class="pv-comm-value">${insurance}</td>
          </tr>
          <tr>
            <td class="pv-comm-label">Guarantee</td>
            <td class="pv-comm-colon">:</td>
            <td class="pv-comm-value">${guarantee}</td>
          </tr>
          <tr>
            <td class="pv-comm-label">Notes</td>
            <td class="pv-comm-colon">:</td>
            <td class="pv-comm-value">${notesParagraphs[0] || 'If RT, UT, PMI, IGC, NACE, Valves or Actuator Spares, Helium & Nitrogen tests required then charges will be extra at actual to your account as given in Price Part – II.'}</td>
          </tr>
        </table>

        <!-- Additional Notes -->
        <div class="pv-comm-notes-box">
          ${notesParagraphs.slice(1).map(p => `<div class="pv-comm-notes-item"><strong>${p}</strong></div>`).join('')}
        </div>

        <!-- PO Cancellation Box -->
        <div class="pv-cancellation-block">
          <strong>PO Cancellation or Modified (qty reduced) charges are as follows:</strong>
          <div style="padding-left: 12px; margin-top: 2px;">
            ${cancelLines.map(l => `<div>${l.startsWith('•') ? l : `&bull; ${l}`}</div>`).join('')}
          </div>
        </div>

        <!-- Jurisdiction -->
        <div class="pv-jurisdiction-line">
          <strong>${jurisdiction}</strong>
        </div>

        <!-- Signatory Block -->
        <div class="pv-signatory-block">
          <div>Thanking you,</div>
          <div>Yours faithfully,</div>
          <div class="pv-sign-for">For, Petro Valves Pvt Ltd.</div>
          <br/>
          <div class="pv-sign-name">${signatoryName}</div>
          <div class="pv-sign-desig">${signatoryDesignation}</div>
          <div class="pv-sign-phone">${signatoryPhone}</div>
          <div class="pv-sign-enclosed">Enclosed: As above.</div>
        </div>

      </div>

      ${renderOfficialFooter()}
    </div>
  `;
}

module.exports = { renderCommercialPart3 };

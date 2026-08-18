const { renderHeader } = require('../components/Header');
const { renderOfficialFooter } = require('../components/Footer');
const { formatPdfValue } = require('../dataFormatter');

function formatDate(d) {
  if (!d) return new Date().toLocaleDateString('en-GB');
  const date = new Date(d);
  if (isNaN(date.getTime())) return formatPdfValue(d);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

function renderTechnicalPart1(quotation) {
  const customer = quotation.customer || {};
  const enquiry = quotation.enquiry || {};

  const offerNo = formatPdfValue(quotation.quotationId, 'PV/J/QTN/P-001/26-27');
  const offerDate = formatDate(quotation.createdAt || new Date());
  
  const rawCustomerName = quotation.senderCompany || enquiry.senderCompany || customer.companyName || quotation.clientName || 'ABC Contractor';
  const customerName = formatPdfValue(rawCustomerName, 'ABC Contractor');

  const rawLocation = customer.address || customer.city || enquiry.location || 'Ahmedabad';
  const location = formatPdfValue(rawLocation, 'Ahmedabad');
  
  const rawContactNo = quotation.contactMobile || customer.mobileNumber || enquiry.contactMobile || '+91 90237232XX';
  const contactNo = formatPdfValue(rawContactNo, '+91 90237232XX');

  const rawEmailId = quotation.contactEmail || customer.emailAddress || enquiry.contactEmail || 'sales@petrovalves.co.in';
  const emailId = formatPdfValue(rawEmailId, 'sales@petrovalves.co.in');
  
  const rawKindAttention = quotation.kindAttention || customer.primaryContactName || enquiry.contactPerson || 'Mr. Jay';
  const kindAttention = formatPdfValue(rawKindAttention, 'Mr. Jay');
  
  let enquiryRef = quotation.enquiryRefText;
  if (!enquiryRef) {
    const enqDate = enquiry.createdAt ? formatDate(enquiry.createdAt) : '05/07/26';
    enquiryRef = `Your Enquiry by &nbsp; E-Mail &nbsp; on DT. &nbsp; ${enqDate}`;
  } else {
    enquiryRef = formatPdfValue(enquiryRef);
  }

  const rawProject = quotation.projectName || enquiry.projectName || enquiry.subject || 'Pipeline Project';
  const project = formatPdfValue(rawProject, 'Pipeline Project');

  const rawSubject = quotation.subjectText || 'Offer for Valves as per your requirements.';
  const subject = formatPdfValue(rawSubject, 'Offer for Valves as per your requirements.');
  
  const rawOpeningText = quotation.salutationOpeningText || 'We acknowledge with thanks the receipt of your above referred enquiry and we are pleased to submit our proposal as under.';
  let openingText = formatPdfValue(rawOpeningText, 'We acknowledge with thanks the receipt of your above referred enquiry and we are pleased to submit our proposal as under.');
  openingText = openingText.replace(/^(?:Dear Sir,?\s*)+/i, '').trim();

  const rawTechClause = quotation.technicalSpecificationClause || 'We offered our valves as per Specification given in Contract Review Check.';
  const techClause = formatPdfValue(rawTechClause, 'We offered our valves as per Specification given in Contract Review Check.');
  
  let deviations = quotation.technicalDeviations || '';
  if (typeof deviations === 'object') {
    deviations = formatPdfValue(deviations, '');
  }
  const deviationLines = deviations
    ? String(deviations).split('\n').map(l => l.trim()).filter(Boolean)
    : [];

  return `
    <div class="pv-page">
      <div class="pv-page-content">
        ${renderHeader()}

        <div class="pv-meta-grid">
          <div class="pv-offer-no">Offer No.: &nbsp; ${offerNo}</div>
          <div class="pv-date">Date: &nbsp; ${offerDate}</div>
        </div>

        <div class="pv-customer-block">
          <div class="pv-to">To,</div>
          <div class="pv-ms-row">
            <div class="pv-ms-label">M/s.</div>
            <div class="pv-ms-name">${customerName}</div>
          </div>
          <div class="pv-ms-address">${location}</div>
        </div>

        <div class="pv-contact-info-block">
          <div class="pv-contact-row">
            <div class="pv-contact-label">Contact No:-</div>
            <div class="pv-contact-val">${contactNo}</div>
          </div>
          <div class="pv-contact-row">
            <div class="pv-contact-label">E-Mail ID:-</div>
            <div class="pv-contact-val">${emailId}</div>
          </div>
        </div>

        <table class="pv-ref-table">
          <tr>
            <td class="pv-ref-label">Kind Attention</td>
            <td class="pv-ref-colon">:</td>
            <td class="pv-ref-value">${kindAttention}</td>
          </tr>
          <tr>
            <td class="pv-ref-label">Enquiry Reference</td>
            <td class="pv-ref-colon">:</td>
            <td class="pv-ref-value">${enquiryRef}</td>
          </tr>
          <tr>
            <td class="pv-ref-label">Project</td>
            <td class="pv-ref-colon">:</td>
            <td class="pv-ref-value">${project}</td>
          </tr>
          <tr class="pv-subject-row">
            <td class="pv-ref-label">Subject</td>
            <td class="pv-ref-colon">:</td>
            <td class="pv-ref-value">${subject}</td>
          </tr>
        </table>

        <div class="pv-salutation-block">
          <div class="pv-dear-sir">Dear Sir,</div>
          <div>${openingText}</div>
        </div>

        <div class="pv-section-title">
          TECHNICAL PART – I
        </div>

        <div class="pv-tech-bullets">
          <div class="pv-tech-bullet-item">&bull; ${techClause}</div>
          <div class="pv-tech-bullet-item">&bull; Deviation, If any</div>
          <div class="pv-deviation-sub-bullets">
            ${deviationLines.length > 0 
              ? deviationLines.map(line => `<div>&bull; ${line}</div>`).join('') 
              : `<div>&bull;</div><div>&bull;</div><div>&bull;</div>`
            }
          </div>
        </div>
      </div>

      ${renderOfficialFooter()}
    </div>
  `;
}

module.exports = { renderTechnicalPart1 };

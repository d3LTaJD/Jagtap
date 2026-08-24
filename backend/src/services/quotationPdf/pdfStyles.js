const pdfStyles = `
  @page {
    size: A4 portrait;
    margin: 0;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 0;
    font-family: 'Times New Roman', Times, 'Liberation Serif', serif;
    color: #000000;
    background: #ffffff;
    font-size: 11px;
    line-height: 1.3;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .pv-page {
    width: 210mm;
    min-height: 297mm;
    box-sizing: border-box;
    padding: 12mm 15mm 10mm 15mm;
    margin: 0 auto;
    position: relative;
    page-break-after: always;
    page-break-inside: avoid;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: #ffffff;
  }

  .pv-page:last-child {
    page-break-after: avoid;
  }

  .pv-page-content {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  /* Compact Page for Checklist (Pages 2 & 3) */
  .pv-page-checklist {
    padding: 6mm 10mm 5mm 10mm;
    font-size: 6.2px;
    line-height: 1.05;
  }

  /* Header Styles */
  .pv-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }

  .pv-header-right {
    text-align: right;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .pv-logo-img {
    height: 48px;
    width: auto;
    object-fit: contain;
    margin-bottom: 2px;
  }

  .pv-company-title {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 17px;
    font-weight: bold;
    color: #c44122;
    letter-spacing: 0.2px;
  }

  /* Offer Metadata Grid */
  .pv-meta-grid {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 15px;
    margin-bottom: 22px;
    font-size: 13px;
    font-weight: bold;
  }

  .pv-offer-no {
    font-size: 13px;
  }

  .pv-date {
    font-size: 13px;
  }

  /* To / Customer Block */
  .pv-customer-block {
    margin-bottom: 20px;
    font-size: 12px;
    line-height: 1.4;
  }

  .pv-customer-block .pv-to {
    font-weight: bold;
  }

  .pv-customer-block .pv-ms-row {
    display: flex;
    gap: 15px;
  }

  .pv-customer-block .pv-ms-label {
    font-weight: bold;
    min-width: 45px;
  }

  .pv-customer-block .pv-ms-name {
    font-weight: bold;
  }

  .pv-customer-block .pv-ms-address {
    padding-left: 60px;
    color: #111;
  }

  /* Contact & Email */
  .pv-contact-info-block {
    margin-bottom: 22px;
    font-size: 12px;
    line-height: 1.5;
  }

  .pv-contact-row {
    display: flex;
    gap: 8px;
  }

  .pv-contact-label {
    font-weight: bold;
    min-width: 95px;
  }

  /* Reference Block */
  .pv-ref-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 25px;
    font-size: 12px;
  }

  .pv-ref-table tr td {
    padding: 3px 0;
    vertical-align: top;
  }

  .pv-ref-table .pv-ref-label {
    font-weight: bold;
    width: 140px;
    white-space: nowrap;
  }

  .pv-ref-table .pv-ref-colon {
    width: 15px;
    text-align: center;
    font-weight: bold;
  }

  .pv-ref-table .pv-ref-value {
    font-weight: normal;
  }

  .pv-ref-table tr.pv-subject-row td {
    padding-bottom: 6px;
    border-bottom: 1.5px solid #000000;
  }

  .pv-ref-table tr.pv-subject-row .pv-ref-value {
    font-weight: 500;
  }

  /* Salutation & Intro */
  .pv-salutation-block {
    margin-top: 15px;
    margin-bottom: 30px;
    font-size: 12px;
    line-height: 1.5;
  }

  .pv-salutation-block .pv-dear-sir {
    margin-bottom: 12px;
  }

  /* Section Title */
  .pv-section-title {
    text-align: center;
    font-size: 14px;
    font-weight: bold;
    text-decoration: underline;
    margin: 25px 0 20px 0;
    letter-spacing: 0.5px;
  }

  /* Technical Bullets */
  .pv-tech-bullets {
    font-size: 12px;
    line-height: 1.8;
    margin-bottom: 30px;
    padding-left: 5px;
  }

  .pv-tech-bullet-item {
    margin-bottom: 6px;
  }

  .pv-deviation-sub-bullets {
    padding-left: 25px;
    margin-top: 5px;
    line-height: 1.8;
  }

  /* Official Footer Styles */
  .pv-footer-container {
    width: 100%;
    margin-top: auto;
    font-family: Arial, Helvetica, sans-serif;
  }

  .pv-footer-top-line {
    display: flex;
    justify-content: space-between;
    font-size: 9.5px;
    color: #000000;
    font-weight: normal;
    margin-bottom: 4px;
  }

  .pv-footer-banner {
    background: linear-gradient(135deg, #5b6065 0%, #767b80 100%);
    color: #ffffff;
    display: flex;
    border-radius: 0px;
    padding: 7px 12px;
    font-size: 8px;
    line-height: 1.35;
    position: relative;
  }

  .pv-footer-banner::after {
    content: '';
    position: absolute;
    top: 5px;
    bottom: 5px;
    left: 51%;
    width: 1px;
    background: rgba(255, 255, 255, 0.4);
    transform: skewX(-15deg);
  }

  .pv-footer-col {
    flex: 1;
  }

  .pv-footer-col-left {
    padding-right: 15px;
  }

  .pv-footer-col-right {
    padding-left: 20px;
  }

  .pv-footer-col-title {
    font-weight: bold;
    font-size: 8.5px;
    margin-bottom: 2px;
  }

  .pv-footer-cin-gstin {
    text-align: center;
    font-size: 8px;
    font-weight: bold;
    color: #000000;
    margin-top: 4px;
    letter-spacing: 0.3px;
  }

  /* Checklist Header (Pages 2 & 3) */
  .pv-chk-header {
    text-align: center;
    position: relative;
    margin-bottom: 6px;
  }

  .pv-chk-company-name {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    font-weight: bold;
    color: #000000;
    margin-bottom: 2px;
  }

  .pv-chk-title {
    font-size: 10px;
    font-weight: bold;
    letter-spacing: 0.5px;
  }

  .pv-chk-meta-box {
    position: absolute;
    top: 0;
    right: 0;
    border: 1px solid #000000;
    font-size: 7.5px;
    border-collapse: collapse;
  }

  .pv-chk-meta-box td {
    border: 1px solid #000000;
    padding: 1.5px 5px;
    font-weight: bold;
  }

  /* Checklist Matrix Table */
  .pv-chk-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    font-size: 6.2px;
    line-height: 1.05;
    font-family: Arial, Helvetica, sans-serif;
    word-wrap: break-word;
  }

  .pv-chk-table th, .pv-chk-table td {
    border: 0.5px solid #000000;
    padding: 1px 1.5px;
    vertical-align: middle;
    overflow: hidden;
  }

  .pv-chk-table th {
    background-color: #ffffff;
    font-weight: bold;
    text-align: center;
    font-size: 6.2px;
  }

  .pv-chk-table .col-sr {
    width: 22px;
    text-align: center;
    font-weight: bold;
    font-size: 6px;
  }

  .pv-chk-table .col-desc {
    width: 150px;
    text-align: left;
    font-weight: 500;
    font-size: 6px;
    line-height: 1.05;
  }

  .pv-chk-table .col-val {
    text-align: center;
    font-size: 6px;
    word-break: break-word;
    overflow: hidden;
  }

  .pv-chk-section-header {
    background-color: #ffffff;
    font-weight: bold;
    text-align: center;
    font-size: 7px;
    padding: 1.5px 0;
    letter-spacing: 0.3px;
  }

  /* Checklist Footer */
  .pv-checklist-footer-container {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 6.5px;
    margin-top: 4px;
    padding-top: 2px;
  }

  .pv-chk-foot-left {
    flex: 1;
  }

  .pv-chk-foot-mid {
    flex: 1;
    text-align: center;
  }

  .pv-chk-foot-right {
    flex: 1;
    text-align: right;
  }

  .pv-chk-page-num {
    font-weight: bold;
    font-size: 7px;
    margin-top: 2px;
  }

  /* General Review Box (Page 3) */
  .pv-general-review-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 6.8px;
    font-family: Arial, Helvetica, sans-serif;
    line-height: 1.15;
    margin-top: 4px;
  }

  .pv-general-review-table td {
    border: 0.5px solid #000000;
    padding: 1.5px 3px;
    vertical-align: top;
  }

  .pv-general-review-title {
    text-align: center;
    font-weight: bold;
    font-size: 7px;
    padding: 1.5px 0;
  }

  .pv-checkbox-checked {
    display: inline-block;
    font-weight: bold;
  }

  /* Price Part-II Table */
  .pv-price-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 7.5px;
    margin-top: 8px;
    word-wrap: break-word;
  }

  .pv-price-table th, .pv-price-table td {
    border: 0.5px solid #000000;
    padding: 2px 2px;
    text-align: center;
    vertical-align: middle;
    overflow: hidden;
  }

  .pv-price-table .pv-price-label-col {
    text-align: left;
    font-weight: bold;
    width: 155px;
    font-size: 7px;
  }

  .pv-price-table .pv-price-summary-label {
    text-align: left;
    font-weight: bold;
    padding-left: 6px;
    font-size: 7.5px;
  }

  .pv-price-table .pv-price-summary-val {
    text-align: right;
    padding-right: 8px;
    font-weight: bold;
    font-size: 7.5px;
  }

  .pv-price-intro {
    font-size: 10.5px;
    margin-bottom: 6px;
    line-height: 1.4;
  }

  /* Commercial Part-III Terms */
  .pv-comm-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5px;
    line-height: 1.4;
    margin-top: 10px;
    margin-bottom: 12px;
  }

  .pv-comm-table tr td {
    padding: 2.5px 0;
    vertical-align: top;
  }

  .pv-comm-label {
    font-weight: bold;
    width: 165px;
    white-space: nowrap;
  }

  .pv-comm-colon {
    width: 15px;
    text-align: center;
    font-weight: bold;
  }

  .pv-comm-value {
    text-align: justify;
  }

  .pv-comm-notes-box {
    font-size: 10px;
    line-height: 1.35;
    margin-top: 6px;
  }

  .pv-comm-notes-item {
    margin-bottom: 4px;
  }

  .pv-cancellation-block {
    margin-top: 8px;
    font-size: 10px;
    line-height: 1.35;
  }

  .pv-jurisdiction-line {
    margin-top: 8px;
    font-size: 10.5px;
    font-weight: bold;
  }

  .pv-signatory-block {
    margin-top: 14px;
    font-size: 10.5px;
    line-height: 1.35;
  }

  .pv-sign-for {
    font-weight: bold;
    margin-bottom: 6px;
  }

  .pv-sign-name {
    font-weight: bold;
  }

  .pv-sign-enclosed {
    font-size: 9.5px;
    margin-top: 3px;
  }
`;

module.exports = pdfStyles;

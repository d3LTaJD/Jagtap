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
 * Generate official Petro Valves Quality Assurance Plan PDF matching Format No. R/5.2/1 Rev01
 * Layout: Exact 4-page A4 Landscape with full table cell spans and official stamp
 */
async function generateQapPdf(qap) {
  const logoBase64 = getLogoBase64();
  
  // Extract all dynamic values
  const qapNo = qap.qapNumber || qap.qapId || 'PV/QAP/PTISL/P2627041/BV/WCC';
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

  const mocBody = vd.bodyMoc || 'ASTM A216 Gr.WCC';
  const mocBall = vd.trimMoc || 'ASTM A351 Gr.CF8M';
  const mocStem = vd.stemMoc || 'ASTM A479 Gr.410\n(NO CASTING)';
  const mocSeat = vd.seatMoc || 'ASTM A182 Gr.F6A';
  const mocFastener = vd.fastenerMoc || 'ASTM A193 Gr.B7 /\nASTM A194 Gr.2H';
  const mocPup = vd.pupPieceMoc || 'ASTM A106 Gr.B THICK 6.4MM /\nAs per Approved G.A Drg.';

  const renderHeader = () => `
    <table class="hdr-table">
      <tr>
        <td style="width: 53%; vertical-align: top; padding: 4px 6px;">
          <div class="mfg-line">Manufactures: <span class="mfg-bold">Petro Valves Pvt.Ltd.</span></div>
          <div class="meta-row"><strong>END USER :</strong> ${endUser}</div>
          <div class="meta-row"><strong>CLIENT :</strong> ${clientName}</div>
          <div class="meta-row"><strong>PROJECT :</strong> ${projectName}</div>
          <table style="width: 100%; border: none; border-collapse: collapse; margin-top: 1px;">
            <tr>
              <td style="border: none; padding: 0; font-size: 7.2pt;"><strong>CLIENT P.O. No.:</strong> ${clientPoNo}</td>
              <td style="border: none; padding: 0; text-align: right; font-size: 7.2pt; padding-right: 15px;"><strong>DT.</strong> ${clientPoDate}</td>
            </tr>
          </table>
        </td>
        <td style="width: 29%; vertical-align: top; padding: 4px 6px;">
          <div class="qap-meta-line"><strong>QAP No.:</strong> ${qapNo}</div>
          <table style="width: 100%; border: none; border-collapse: collapse; margin-bottom: 2px;">
            <tr>
              <td style="border: none; padding: 0; font-size: 7.2pt;"><strong>REV No.:</strong> ${revNo}</td>
              <td style="border: none; padding: 0; text-align: right; font-size: 7.2pt;"><strong>DATED:</strong> ${qapDate}</td>
            </tr>
          </table>
          <div class="valve-block">
            <div><strong>VALVES DETAIL : ${valveType}</strong></div>
            <div><strong>(FOR ${designStd})</strong></div>
            <div>${itemCode}</div>
            <div><strong>${sizeRatingEnd}</strong></div>
          </div>
        </td>
        <td style="width: 18%; vertical-align: middle; text-align: center; padding: 4px;">
          ${logoBase64 ? `<img src="${logoBase64}" style="max-height: 38px; max-width: 110px; display: block; margin: 0 auto 2px auto;" />` : ''}
          <div style="font-size: 8.5pt; font-weight: 900; color: #a03020; letter-spacing: 0.2px;">Petro Valves Pvt. Ltd.</div>
        </td>
      </tr>
    </table>
    <div class="title-banner">QUALITY ASSURANCE PLAN</div>
  `;

  const renderTableHead = () => `
    <thead>
      <tr class="th-top">
        <th rowspan="2" style="width: 3.5%;">Sr.<br>No.</th>
        <th rowspan="2" style="width: 15%;">COMPONENTS &amp;<br>OPERATIONS</th>
        <th rowspan="2" style="width: 17%;">TYPE OF CHECK</th>
        <th rowspan="2" style="width: 13%;">QUANTAM OF CHECK</th>
        <th rowspan="2" style="width: 16%;">REFERANCE DOCUMENT</th>
        <th rowspan="2" style="width: 16%;">ACCEPTANCE NORMS</th>
        <th rowspan="2" style="width: 11.5%;">FORMAT OF RECORD</th>
        <th rowspan="2" style="width: 4%;">IN HOUSE (I) /<br>OUT SOURCE(O)</th>
        <th colspan="2" style="width: 4%;">INSPECTION</th>
      </tr>
      <tr class="th-sub">
        <th style="width: 2%;">PVPL/<br>SUPPLIER</th>
        <th style="width: 2%;">TPI / CLIENT</th>
      </tr>
    </thead>
  `;

  const renderFooter = (pageStr) => `
    <div class="footer-wrap">
      <table class="footer-table">
        <tr>
          <td style="width: 32%; text-align: left; font-size: 7pt; font-weight: bold;">
            Format No.R/5.2/1 &nbsp;Rev01 Effective From 15-Sept-2022
          </td>
          <td style="width: 20%; text-align: center; font-size: 7.5pt; font-weight: bold;">
            Prepared BY: ${qap.preparedByName || 'QC Engg.'}
          </td>
          <td style="width: 16%; text-align: center;">
            <svg viewBox="0 0 160 160" width="58" height="58">
              <circle cx="80" cy="80" r="74" fill="none" stroke="#2255a4" stroke-width="2.5" stroke-dasharray="5,3" />
              <circle cx="80" cy="80" r="66" fill="none" stroke="#2255a4" stroke-width="1.5" />
              <circle cx="80" cy="80" r="46" fill="none" stroke="#2255a4" stroke-width="1" />
              <path id="txtPathTop" d="M 24 80 A 56 56 0 0 1 136 80" fill="none" stroke="none" />
              <path id="txtPathBottom" d="M 136 80 A 56 56 0 0 1 24 80" fill="none" stroke="none" />
              <text font-family="Arial, sans-serif" font-size="10" font-weight="900" fill="#2255a4" letter-spacing="1.2">
                <textPath href="#txtPathTop" startOffset="50%" text-anchor="middle">PETRO VALVES PVT. LTD.</textPath>
              </text>
              <text font-family="Arial, sans-serif" font-size="9" font-weight="800" fill="#2255a4" letter-spacing="1.5">
                <textPath href="#txtPathBottom" startOffset="50%" text-anchor="middle">&#9733; AHMEDABAD &#9733;</textPath>
              </text>
              <text x="80" y="76" font-family="Arial, sans-serif" font-size="11" font-weight="900" fill="#2255a4" text-anchor="middle">QUALITY</text>
              <text x="80" y="91" font-family="Arial, sans-serif" font-size="10" font-weight="900" fill="#2255a4" text-anchor="middle">CONTROL</text>
            </svg>
          </td>
          <td style="width: 22%; text-align: right; font-size: 7.5pt; font-weight: bold;">
            Approved By: ${qap.approvedByName || 'Incharge Q.C.'}
          </td>
          <td style="width: 10%; text-align: right; font-size: 8pt; font-weight: 900; padding-right: 4px;">
            ${pageStr}
          </td>
        </tr>
      </table>
    </div>
  `;

  // Page 1 Table Body
  const p1Tbody = `
    <tbody>
      <tr class="sec-tr">
        <td class="text-center font-bold">1</td>
        <td colspan="9" class="font-bold">RAW MATERIAL (Critical)</td>
      </tr>
      <tr>
        <td rowspan="7"></td>
        <td rowspan="7" class="font-bold">1) Body, Side P/c, Bonnet, Trunnion</td>
        <td>1.Heat Treatment</td>
        <td class="text-center">100%</td>
        <td rowspan="4">${mocBody}</td>
        <td rowspan="4">${mocBody}</td>
        <td rowspan="4">Foundry Report as per EN10204 Type (ISO 10474) 3.1</td>
        <td rowspan="4" class="text-center">O</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>2.Chem.Test</td>
        <td rowspan="3" class="text-center">Per Heat</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>3.Phy.Test</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>4.Hardness Test</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>5.Visual &amp; Dim.</td>
        <td class="text-center">Visual 100% / Dimensions 1%</td>
        <td>MSS-SP-55 &amp; PV/PRO /VT/03 API 6D/ Casting Drg.</td>
        <td>MSS-SP-55 &amp; PV/PRO /VT/03 API 6D/ Casting Drg.</td>
        <td>Inspection Report</td>
        <td class="text-center font-bold">I</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>6.Impact Test at -29°C</td>
        <td class="text-center">Per Heat</td>
        <td>ASTM A 370</td>
        <td>Energy Value 27J Avg./ 22J Min (One Spec)/ Applicable Material Std./ Data sheet</td>
        <td>Lab T.C/ Foundry T.C./ 3.1 Certi.</td>
        <td class="text-center font-bold">O</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>7.MPT Test (Casting of Body &amp; S.P)*</td>
        <td class="text-center">100%</td>
        <td>ASME B16.34, App-II/ PV/PRO/MPT/03</td>
        <td>ASME B16.34, App-II/ PV/PRO/MPT/03</td>
        <td>Inspection Report</td>
        <td class="text-center font-bold">I/O</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>

      <!-- 2) Ball -->
      <tr>
        <td rowspan="6"></td>
        <td rowspan="6" class="font-bold">2) Ball</td>
        <td>1.Heat Treatment</td>
        <td class="text-center">100%</td>
        <td rowspan="4">${mocBall}</td>
        <td rowspan="4">${mocBall}</td>
        <td rowspan="4">Foundry Report as per EN10204 Type (ISO 10474) 3.1</td>
        <td rowspan="4" class="text-center">O</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>2.Chem.Test</td>
        <td rowspan="3" class="text-center">Per Heat</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>3.Phy.Test</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>4.Hardness Test</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>5.Visual &amp; Dim.</td>
        <td class="text-center">Visual 100% / Dimensions 1%</td>
        <td>MSS-SP-55 &amp; PV/PRO /VT/03 API 6D/ Casting Drg.</td>
        <td>MSS-SP-55 &amp; PV/PRO /VT/03 API 6D/ Casting Drg.</td>
        <td>Inspection Report</td>
        <td class="text-center font-bold">I</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>6.Impact Test at -29°C</td>
        <td class="text-center">Per Heat</td>
        <td>ASTM A 370</td>
        <td>Energy Value 27J Avg./ 22J Min (One Spec)/ Applicable Material Std./ Data sheet</td>
        <td>Lab T.C/ Foundry T.C./ 3.1 Certi.</td>
        <td class="text-center font-bold">O</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>

      <!-- 3) Stem -->
      <tr>
        <td rowspan="5"></td>
        <td rowspan="5" class="font-bold">3) Stem (R.bar)</td>
        <td>1.Chem.Test</td>
        <td class="text-center">Per R. Bar/ Heat</td>
        <td rowspan="3" style="white-space: pre-line;">${mocStem}</td>
        <td rowspan="3" style="white-space: pre-line;">${mocStem}</td>
        <td rowspan="3">Supplier/ Lab T.C / 3.1 Certi.</td>
        <td rowspan="3" class="text-center">O</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>2.Phy.Test</td>
        <td class="text-center">Per R. Bar/ Heat</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>3.Hardness Test</td>
        <td class="text-center">Per R. Bar/ Heat</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>4.Visual &amp; Dim.</td>
        <td class="text-center">Visual 100% / Dimensions 1%</td>
        <td>PV/PRO /VT/03/ Internal Drg.</td>
        <td>PV/PRO /VT/03/ Internal Drg.</td>
        <td>Incoming GRN/ IIR</td>
        <td class="text-center font-bold">I</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>5.Impact Test at 0°C</td>
        <td class="text-center">Per R. Bar/ Heat</td>
        <td>ASTM A 370</td>
        <td>Energy Value 27J Avg./ 22J Min (One Spec)/ Applicable Material Std./ Data sheet</td>
        <td>Lab T.C/ Foundry T.C./ 3.1 Certi.</td>
        <td class="text-center font-bold">O</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
    </tbody>
  `;

  // Page 2 Table Body
  const p2Tbody = `
    <tbody>
      <tr>
        <td rowspan="5"></td>
        <td rowspan="5" class="font-bold">4) Seat Holder</td>
        <td>2.Chem.Test</td>
        <td rowspan="3" class="text-center">Per Heat</td>
        <td rowspan="3">${mocSeat}</td>
        <td rowspan="3">${mocSeat}</td>
        <td rowspan="3">Foundry Report as per EN10204 Type (ISO 10474) 3.1</td>
        <td rowspan="3" class="text-center">O</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>3.Phy.Test</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>4.Hardness Test</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>5.Visual &amp; Dim.</td>
        <td class="text-center">Visual 100% / Dimensions 1%</td>
        <td>PV/PRO /VT/03/ API 6D/ Forging Drg.</td>
        <td>PV/PRO /VT/03/ API 6D/ Forging Drg.</td>
        <td>Inspection Report</td>
        <td class="text-center font-bold">I</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>6.Impact Test at 0°C</td>
        <td class="text-center">Per Heat</td>
        <td>ASTM A 370</td>
        <td>Energy Value 27J Avg./ 22J Min (One Spec)/ Applicable Material Std./ Data sheet</td>
        <td>Lab T.C/ Foundry T.C./ 3.1 Certi.</td>
        <td class="text-center font-bold">O</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>

      <!-- SECTION 2 -->
      <tr class="sec-tr">
        <td class="text-center font-bold">2</td>
        <td colspan="9" class="font-bold">BOUGHTOUT ITEMS</td>
      </tr>
      <tr>
        <td rowspan="5"></td>
        <td rowspan="5" class="font-bold">1) Pressure boundry fastners. (Where Applicable)<br>API 20 E BSL-1 (Compliance Certi.) (Critical)</td>
        <td>1.Chem.Test</td>
        <td rowspan="3" class="text-center">Per Lot/Heat</td>
        <td rowspan="3" style="white-space: pre-line;">${mocFastener}</td>
        <td rowspan="3" style="white-space: pre-line;">${mocFastener}</td>
        <td rowspan="3">Supplier's T.C/ Lab T.C./ 3.1 Certi.</td>
        <td rowspan="3" class="text-center">O</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>2.Phy.Test</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>3.Hardness Test</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>4.Impact Test at -29°C (For 14MM and Above size)</td>
        <td class="text-center">Per Lot/Heat</td>
        <td>ASTM A 370</td>
        <td>Energy Value 27J Avg./ 22J Min (One Spec)/ Applicable Material Std.</td>
        <td>Supplier's T.C/ Lab T.C./ 3.1 Certi.</td>
        <td class="text-center font-bold">O</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>5.Dimensions</td>
        <td class="text-center">1% Per Lot</td>
        <td>Internal Drg.</td>
        <td>Internal Drg.</td>
        <td>Incoming GRN/ Incoming inspection report</td>
        <td class="text-center font-bold">I</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>

      <!-- Pup piece -->
      <tr>
        <td rowspan="5"></td>
        <td rowspan="5" class="font-bold">2) Pup Piece (Critical)</td>
        <td>1.Chem.Test</td>
        <td rowspan="3" class="text-center">Per Lot/Heat</td>
        <td rowspan="3" style="white-space: pre-line;">${mocPup}</td>
        <td rowspan="3" style="white-space: pre-line;">${mocPup}</td>
        <td rowspan="3">Supplier's T.C/ Lab TC.</td>
        <td rowspan="3" class="text-center">O</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>2.Phy.Test</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>3.Hardness Test</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>4.Impact Test at -29°C</td>
        <td class="text-center">Per Lot/Heat</td>
        <td>ASTM A370</td>
        <td>Energy Value 27J Avg./ 22J Min(One Spec)/ Applicable Material Std.</td>
        <td>Supplier's T.C/ Lab TC.</td>
        <td class="text-center font-bold">O</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>5.Visual &amp; Dim.</td>
        <td class="text-center">10%</td>
        <td>Surface Defect/ Applicable Sch Th.</td>
        <td>No Surface Defect Accepted/ Applicable Sch Th.</td>
        <td>Incoming GRN/ Incoming inspection report</td>
        <td class="text-center font-bold">I</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>

      <!-- SECTION 3 -->
      <tr class="sec-tr">
        <td class="text-center font-bold">3</td>
        <td colspan="9" class="font-bold">INPROCESS INP.</td>
      </tr>
      <tr>
        <td rowspan="4"></td>
        <td rowspan="4" class="font-bold">1) Body, Side P/c, Ball, Stem<br>(Critical Items)</td>
        <td>1.Transfer Of Heat No. (Body &amp; S/P) (If Remove during M/C)</td>
        <td class="text-center">100%</td>
        <td>Petro Q.M./ P.M.</td>
        <td>Petro Q.M./ P.M.</td>
        <td>In Process Ins.Report/ Process Route Card/ Inspection Report</td>
        <td class="text-center font-bold">I</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>2.Pup Welding</td>
        <td class="text-center">100%</td>
        <td>As Per Petro WPS, PQR</td>
        <td>As Per Petro WPS, PQR</td>
        <td>In Process Ins.Report/ Process Route Card/ Inspection Report</td>
        <td class="text-center font-bold">I</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>3.RT of Butt Weld Joint</td>
        <td class="text-center">100%</td>
        <td>ASME BPVC Section V, Article 2</td>
        <td>ASME SECT. VIII, Div.1, UW 51</td>
        <td>RT Report</td>
        <td class="text-center font-bold">O</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>4.MPT of Bevel End (Before &amp; After Weld)</td>
        <td class="text-center">100%</td>
        <td>ASME BPVC Section V, Article 7</td>
        <td>ASME BPVC, Section VIII, Division 1, Appendix 6</td>
        <td>MPT Test Report</td>
        <td class="text-center font-bold">I/O</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
    </tbody>
  `;

  // Page 3 Table Body
  const p3Tbody = `
    <tbody>
      <!-- SECTION 4 -->
      <tr class="sec-tr">
        <td class="text-center font-bold">4</td>
        <td colspan="9" class="font-bold">ASSEMBLY</td>
      </tr>
      <tr>
        <td rowspan="2"></td>
        <td rowspan="2" class="font-bold">Ball valve</td>
        <td>1.Visual &amp; Dim.</td>
        <td class="text-center">100%</td>
        <td>Approved GA Drg./ WI</td>
        <td>Approved GA Drg./ WI</td>
        <td>Inspection Report</td>
        <td class="text-center font-bold">I</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">--</td>
      </tr>
      <tr>
        <td>2.Fitment &amp; Alignment</td>
        <td class="text-center">100%</td>
        <td>Approved GA Drg./ WI<br>W.I : 5.6.1/03</td>
        <td>Approved GA Drg./ WI<br>W.I : 5.6.1/03</td>
        <td>Inspection Report</td>
        <td class="text-center font-bold">I</td>
        <td class="text-center font-bold">P</td>
        <td class="text-center font-bold">--</td>
      </tr>

      <!-- SECTION 5 -->
      <tr class="sec-tr">
        <td class="text-center font-bold">5</td>
        <td colspan="9" class="font-bold">FINAL INSPECTIONS</td>
      </tr>
      <tr>
        <td rowspan="11"></td>
        <td rowspan="11" class="font-bold">Ball valve</td>
        <td>1.Visual</td>
        <td class="text-center">100%</td>
        <td rowspan="2">Approved G.A. Drg.</td>
        <td rowspan="2">Approved G.A. Drg.</td>
        <td rowspan="9">Final Inspection Report Sheets</td>
        <td rowspan="9" class="text-center font-bold">I</td>
        <td rowspan="9" class="text-center font-bold">P</td>
        <td rowspan="9" class="text-center font-bold">W</td>
      </tr>
      <tr>
        <td>2.Dimensions</td>
        <td class="text-center">100%</td>
      </tr>
      <tr>
        <td>3.Hyd Body Test</td>
        <td class="text-center">100%</td>
        <td rowspan="7">Appvd. Drg. &amp;<br>API 6D 25TH ED.</td>
        <td rowspan="7">Appvd. Drg. &amp;<br>API 6D 25TH ED.</td>
      </tr>
      <tr>
        <td>4.Hyd Seat Test</td>
        <td class="text-center">100%</td>
      </tr>
      <tr>
        <td>5.Air Seat Test</td>
        <td class="text-center">100%</td>
      </tr>
      <tr>
        <td>6.DBB Hydro for DBB Valves</td>
        <td class="text-center">100%</td>
      </tr>
      <tr>
        <td>7.Operational Torque Test</td>
        <td class="text-center">One Valve per size per Rating in each Group</td>
      </tr>
      <tr>
        <td>8.Antistatic Test</td>
        <td class="text-center">100%</td>
      </tr>
      <tr>
        <td>9.Functional Test (Open &amp; Close)</td>
        <td class="text-center">10%<br>Minimum 10 Cycles</td>
      </tr>
      <tr>
        <td>10.Fire Safe Test</td>
        <td class="text-center">Type Test</td>
        <td>API 6FA</td>
        <td>API 6FA</td>
        <td>Fire Safe Test Certi.</td>
        <td class="text-center font-bold">I</td>
        <td class="text-center font-bold">R</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>11.Calibration of Inst.</td>
        <td class="text-center">100%</td>
        <td>API 6D 25TH ED./ PETRO Q.M.</td>
        <td>API 6D 25TH ED./ PETRO Q.M.</td>
        <td>Calibration Certi.</td>
        <td class="text-center font-bold">O</td>
        <td class="text-center font-bold">R</td>
        <td class="text-center font-bold">R</td>
      </tr>

      <!-- SECTION 6 -->
      <tr class="sec-tr">
        <td class="text-center font-bold">6</td>
        <td colspan="9" class="font-bold">PAINTING</td>
      </tr>
      <tr>
        <td rowspan="7"></td>
        <td rowspan="7"></td>
        <td>1.Visual</td>
        <td class="text-center">100%</td>
        <td rowspan="2">As Per G.A. Drg.</td>
        <td rowspan="2">As Per G.A. Drg.</td>
        <td rowspan="3">Surface Preparation Report</td>
        <td rowspan="4" class="text-center font-bold">I</td>
        <td rowspan="7" class="text-center font-bold">P</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>2.Draining</td>
        <td class="text-center">100%</td>
        <td class="text-center font-bold">--</td>
      </tr>
      <tr>
        <td>3.Surface Preparation SA 2 1/2</td>
        <td class="text-center">100%</td>
        <td rowspan="2">G.A.Drg./ As per Petro Procedure/<br>WI 5.6.1-04</td>
        <td rowspan="2">G.A.Drg./ As per Petro Procedure/<br>WI 5.6.1-04</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>4.Paint Coat</td>
        <td class="text-center">100%/ Random</td>
        <td>Paint Report</td>
        <td class="text-center font-bold">R</td>
      </tr>
      <tr>
        <td>5.Marking/ Tagging/ Name Plate</td>
        <td class="text-center">100%/ Random</td>
        <td rowspan="3">G.A.Drg./ As per Petro Procedure/ WI</td>
        <td rowspan="3">G.A.Drg./ As per Petro Procedure/ WI</td>
        <td rowspan="3">Packing Slip</td>
        <td rowspan="3" class="text-center font-bold">I</td>
        <td class="text-center font-bold">--</td>
      </tr>
      <tr>
        <td>6.Auxillary Fitting</td>
        <td class="text-center">100%/ Random</td>
        <td class="text-center font-bold">--</td>
      </tr>
      <tr>
        <td>7.End Protector</td>
        <td class="text-center">100%/ Random</td>
        <td class="text-center font-bold">--</td>
      </tr>
    </tbody>
  `;

  // Page 4 Table Body & Remarks
  const p4Tbody = `
    <tbody>
      <!-- SECTION 7 -->
      <tr class="sec-tr">
        <td class="text-center font-bold">7</td>
        <td colspan="9" class="font-bold">FINAL DOCUMENTATION</td>
      </tr>
      <tr>
        <td></td>
        <td class="font-bold">Final Documentation</td>
        <td>Review</td>
        <td class="text-center">100%</td>
        <td>As Per API 6D/ Appvd. Drg./ W.O.</td>
        <td>As Per API 6D/ Appvd. Drg./ W.O.</td>
        <td>Final Dossier-IRN, 3.1 Certi. as per EN10204, Inps &amp; Test Report, Drawing, Etc.</td>
        <td class="text-center font-bold">I</td>
        <td class="text-center font-bold">P/H</td>
        <td class="text-center font-bold">R</td>
      </tr>
    </tbody>
  `;

  const p4NotesRemarks = `
    <div class="notes-remarks-block">
      <div class="notes-text">
        <strong>Note:</strong> P - Perform, &nbsp;R-Review :- Doc/MTC/Inspection Reports will be reviewed, &nbsp;H-Hold:- Without completion of this stage further stage shall not be performed, &nbsp;W-Witness:- Test Will be performed in there presence,* - When required by contracts/ Customer.
      </div>
      <div class="remarks-title"><strong>Remark:</strong></div>
      <div class="remark-item">1) For Material Specification refer "Material Specification Sheet" No. R-5.5.2-2 Rev.01 for Respective Material Grade &amp; Approved GAD.</div>
      <div class="remark-item">2) For Pup welding and overlay welding refer WPS/PQR made by Petro valves Pvt. Limited</div>
      <div class="remark-item">3) For NDT (LPT, UT, RT, MPT, Helium leak test) &amp; Final Testing if QSL Level given by client follow table of API 6D Ann-I.</div>
      <div class="remark-item">4) When Revision/ Edition of Standard/documents are not given in QAP then latest edition/ Rev. applies after its effectiveness.</div>
      <div class="remark-item">5) ENP, Hydro test, and Painting Refer Procedure of Petro Valves Pvt. Ltd for reference and Acceptance.</div>
    </div>
  `;

  const css = `
    @page {
      size: A4 landscape;
      margin: 4mm 5mm 4mm 5mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 7.2pt;
      color: #000;
      margin: 0;
      padding: 0;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page-sheet {
      width: 100%;
      height: 200mm;
      max-height: 200mm;
      position: relative;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
    }
    .page-sheet:last-child {
      page-break-after: avoid;
    }
    .content-box {
      border: 1.5px solid #000;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    /* Header */
    .hdr-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      border-bottom: 1.5px solid #000;
    }
    .hdr-table td {
      border-right: 1.5px solid #000;
    }
    .hdr-table td:last-child {
      border-right: none;
    }
    .mfg-line {
      font-size: 9.5pt;
      font-weight: 800;
      margin-bottom: 2px;
    }
    .mfg-bold {
      color: #0b3b60;
      font-size: 10pt;
      font-weight: 900;
    }
    .meta-row {
      font-size: 7.2pt;
      line-height: 1.35;
    }
    .qap-meta-line {
      font-size: 7.5pt;
      padding-bottom: 2px;
      border-bottom: 1px solid #000;
      margin-bottom: 2px;
    }
    .valve-block {
      text-align: center;
      font-size: 7.2pt;
      line-height: 1.25;
      padding-top: 1px;
    }

    /* Title */
    .title-banner {
      width: 100%;
      text-align: center;
      font-family: "Times New Roman", Times, Georgia, serif;
      font-style: italic;
      font-weight: bold;
      font-size: 10.5pt;
      text-decoration: underline;
      padding: 2.5px 0;
      letter-spacing: 0.5px;
      border-bottom: 1.5px solid #000;
      background: #fff;
    }

    /* Table */
    .qap-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      flex-grow: 1;
    }
    .qap-table th, .qap-table td {
      border: 1px solid #000;
      padding: 1.5px 3px;
      font-size: 6.8pt;
      line-height: 1.15;
      vertical-align: middle;
      word-wrap: break-word;
    }
    .th-top th {
      background: #fff;
      font-weight: 800;
      text-align: center;
      font-size: 6.8pt;
      padding: 2px;
      border-bottom: 1px solid #000;
    }
    .th-sub th {
      background: #fff;
      font-weight: 800;
      text-align: center;
      font-size: 6.2pt;
      padding: 2px;
      border-bottom: 1.5px solid #000;
    }
    .sec-tr td {
      background: #fff;
      font-size: 7.5pt;
      padding: 2px 4px;
      border-top: 1.5px solid #000;
      border-bottom: 1px solid #000;
    }
    .text-center {
      text-align: center;
    }
    .font-bold {
      font-weight: bold;
    }

    /* Footer */
    .footer-wrap {
      width: 100%;
      border-top: 1.5px solid #000;
      padding: 1px 4px;
      background: #fff;
    }
    .footer-table {
      width: 100%;
      border-collapse: collapse;
    }
    .footer-table td {
      border: none;
      padding: 1px 2px;
      vertical-align: middle;
    }

    /* Notes & Remarks */
    .notes-remarks-block {
      padding: 4px 6px;
      font-size: 6.8pt;
      line-height: 1.3;
      border-top: 1.5px solid #000;
      flex-grow: 1;
    }
    .notes-text {
      margin-bottom: 3px;
    }
    .remarks-title {
      font-weight: bold;
      margin-bottom: 1px;
    }
    .remark-item {
      padding-left: 6px;
      margin-bottom: 1px;
    }
  `;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>QAP - ${qapNo}</title>
  <style>${css}</style>
</head>
<body>
  <!-- PAGE 1 -->
  <div class="page-sheet">
    <div class="content-box">
      ${renderHeader()}
      <table class="qap-table">
        ${renderTableHead()}
        ${p1Tbody}
      </table>
      ${renderFooter('1 OF 4')}
    </div>
  </div>

  <!-- PAGE 2 -->
  <div class="page-sheet">
    <div class="content-box">
      ${renderHeader()}
      <table class="qap-table">
        ${renderTableHead()}
        ${p2Tbody}
      </table>
      ${renderFooter('2 OF 4')}
    </div>
  </div>

  <!-- PAGE 3 -->
  <div class="page-sheet">
    <div class="content-box">
      ${renderHeader()}
      <table class="qap-table">
        ${renderTableHead()}
        ${p3Tbody}
      </table>
      ${renderFooter('3 OF 4')}
    </div>
  </div>

  <!-- PAGE 4 -->
  <div class="page-sheet">
    <div class="content-box">
      ${renderHeader()}
      <table class="qap-table" style="flex-grow: 0;">
        ${renderTableHead()}
        ${p4Tbody}
      </table>
      ${p4NotesRemarks}
      ${renderFooter('4 OF 4')}
    </div>
  </div>
</body>
</html>
  `;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '4mm', bottom: '4mm', left: '5mm', right: '5mm' }
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = {
  generateQapPdf
};

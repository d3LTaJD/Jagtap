function renderChecklistFooter(pageStr = '1 OF 2') {
  return `
    <div class="pv-checklist-footer-container">
      <div class="pv-chk-foot-left">
        Format No. R/5.1.3.5/2 Rev04 Effective From 15-May-2026
      </div>
      <div class="pv-chk-foot-mid">
        <div class="pv-sign-label">Prepared By:</div>
        <div class="pv-sign-sub">(Marketing / Sales Assistance)</div>
      </div>
      <div class="pv-chk-foot-right">
        <div class="pv-sign-label">Approved By:</div>
        <div class="pv-sign-sub">(Incharge-MKT)</div>
        <div class="pv-chk-page-num">${pageStr}</div>
      </div>
    </div>
  `;
}

module.exports = { renderChecklistFooter };

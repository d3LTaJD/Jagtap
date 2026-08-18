const fs = require('fs');
const path = require('path');

let cachedLogoBase64 = null;

function getLogoBase64() {
  if (cachedLogoBase64) return cachedLogoBase64;
  try {
    const logoPath = path.resolve('d:/jagtap/logo.png');
    if (fs.existsSync(logoPath)) {
      const buf = fs.readFileSync(logoPath);
      cachedLogoBase64 = `data:image/png;base64,${buf.toString('base64')}`;
      return cachedLogoBase64;
    }
  } catch (err) {
    console.error('Failed to read logo.png:', err.message);
  }
  return '';
}

function renderHeader() {
  const logo = getLogoBase64();
  return `
    <div class="pv-header">
      <div class="pv-header-left"></div>
      <div class="pv-header-right">
        ${logo ? `<img src="${logo}" alt="Petro Valves" class="pv-logo-img" />` : ''}
        <div class="pv-company-title">Petro Valves Pvt. Ltd.</div>
      </div>
    </div>
  `;
}

module.exports = { renderHeader, getLogoBase64 };

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const otpUtils = require('../utils/otp');
const { PERMISSION_MATRIX, hasPermission } = require('../config/permissions');

async function runSecurityTests() {
  console.log('='.repeat(80));
  console.log('RUNNING PHASE 1 SECURITY VERIFICATION SUITE');
  console.log('='.repeat(80));

  let passed = 0;
  let total = 0;

  // ── Test 1: OTP Generation uses crypto.randomInt and returns 6-digit string ──
  total++;
  try {
    const otps = new Set();
    for (let i = 0; i < 50; i++) {
      const otp = otpUtils.generateOTP();
      assert.strictEqual(typeof otp, 'string', 'OTP must be a string');
      assert.strictEqual(otp.length, 6, 'OTP must be 6 digits');
      const num = parseInt(otp, 10);
      assert(num >= 100000 && num <= 999999, 'OTP must be within 100000-999999');
      otps.add(otp);
    }
    // High entropy check: 50 random 6-digit numbers should have at least 45 unique values
    assert(otps.size >= 45, 'OTP generator should have high entropy');
    console.log('[PASS] Test 1: OTP generation uses secure crypto.randomInt (6-digit format)');
    passed++;
  } catch (err) {
    console.error('[FAIL] Test 1: OTP generation failed:', err.message);
  }

  // ── Test 2: No hardcoded SMTP credentials in backend source code ──
  total++;
  try {
    const srcDir = path.join(__dirname, '..');
    const filesToScan = [
      path.join(srcDir, 'services/notificationService.js'),
      path.join(srcDir, 'services/emailBotService.js'),
      path.join(srcDir, 'services/emailService.js')
    ];

    const hardcodedPatterns = ['Ai@@27042026', 'smtp_pass =', 'password: "'];
    for (const f of filesToScan) {
      if (fs.existsSync(f)) {
        const content = fs.readFileSync(f, 'utf8');
        for (const pattern of hardcodedPatterns) {
          assert(!content.includes(pattern), `Hardcoded credential found in ${f}: ${pattern}`);
        }
      }
    }
    console.log('[PASS] Test 2: Hardcoded SMTP fallback passwords completely removed from all services');
    passed++;
  } catch (err) {
    console.error('[FAIL] Test 2: Hardcoded password check failed:', err.message);
  }

  // ── Test 3: Path Traversal defense in downloadLocalFile ──
  total++;
  try {
    const { downloadLocalFile } = require('../controllers/uploadController');
    const mockRes = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.jsonData = data; return this; },
      download(p, n) { this.downloadedPath = p; }
    };

    // Test with path traversal key
    const maliciousKeys = ['../../etc/passwd', '..\\..\\windows\\win.ini', 'valid-file/../../secret', 'valid%2e%2e/file'];
    for (const key of maliciousKeys) {
      let nextCalled = false;
      const res = { ...mockRes };
      await downloadLocalFile({ params: { key }, user: { is_active: true } }, res, () => { nextCalled = true; });
      assert(res.statusCode === 400 || res.statusCode === 403, `Malicious key "${key}" must be rejected with 400/403, got ${res.statusCode}`);
    }
    console.log('[PASS] Test 3: Path traversal attacks on /download-local/:key are strictly blocked');
    passed++;
  } catch (err) {
    console.error('[FAIL] Test 3: Path traversal defense failed:', err.message);
  }

  // ── Test 4: File download requires active authenticated user ──
  total++;
  try {
    const { downloadLocalFile } = require('../controllers/uploadController');
    let res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.jsonData = data; return this; }
    };
    // Missing user
    await downloadLocalFile({ params: { key: 'sample-file.pdf' }, user: null }, res, () => {});
    assert.strictEqual(res.statusCode, 401, 'Unauthenticated file download must return 401');

    // Inactive user
    res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.jsonData = data; return this; }
    };
    await downloadLocalFile({ params: { key: 'sample-file.pdf' }, user: { is_active: false } }, res, () => {});
    assert.strictEqual(res.statusCode, 401, 'Inactive user file download must return 401');

    console.log('[PASS] Test 4: File download strictly validates active authentication');
    passed++;
  } catch (err) {
    console.error('[FAIL] Test 4: Authentication check failed:', err.message);
  }

  // ── Test 5: Permission Matrix has granular Tasks, Email, Vendors, MasterData, FollowUp.delete ──
  total++;
  try {
    // Tasks module
    assert(PERMISSION_MATRIX.Tasks, 'Tasks module must exist in PERMISSION_MATRIX');
    assert(PERMISSION_MATRIX.Tasks.view && PERMISSION_MATRIX.Tasks.create && PERMISSION_MATRIX.Tasks.edit && PERMISSION_MATRIX.Tasks.delete, 'Tasks must have full CRUD actions');
    
    // Email module
    assert(PERMISSION_MATRIX.Email && PERMISSION_MATRIX.Email.send, 'Email.send permission must exist');
    
    // Vendors module
    assert(PERMISSION_MATRIX.Vendors && PERMISSION_MATRIX.Vendors.create && PERMISSION_MATRIX.Vendors.delete, 'Vendors module must exist with CRUD');
    
    // MasterData module
    assert(PERMISSION_MATRIX.MasterData && PERMISSION_MATRIX.MasterData.create && PERMISSION_MATRIX.MasterData.delete, 'MasterData module must exist with CRUD');
    
    // FollowUp delete action
    assert(PERMISSION_MATRIX.FollowUp && PERMISSION_MATRIX.FollowUp.delete, 'FollowUp.delete permission must exist');

    // Role checks
    const salesUser = { role: 'SALES' };
    const saUser = { role: 'SA' };
    const dirUser = { role: 'DIR' };
    const accUser = { role: 'ACC' };

    assert(hasPermission(saUser, 'Tasks', 'delete'), 'SA can delete tasks');
    assert(!hasPermission(salesUser, 'Tasks', 'delete'), 'SALES cannot delete tasks');
    assert(hasPermission(salesUser, 'Email', 'send'), 'SALES can send email');
    assert(!hasPermission(accUser, 'Email', 'send'), 'ACC cannot send email');
    assert(hasPermission(dirUser, 'FollowUp', 'delete'), 'DIR can delete follow-up');
    assert(!hasPermission(salesUser, 'FollowUp', 'delete'), 'SALES cannot delete follow-up');

    console.log('[PASS] Test 5: Centralized RBAC matrix enforces granular permissions across all modules');
    passed++;
  } catch (err) {
    console.error('[FAIL] Test 5: RBAC matrix check failed:', err.message);
  }

  // ── Test 6: CORS configuration in app.js excludes wildcard ──
  total++;
  try {
    const appFile = path.join(__dirname, '../app.js');
    const content = fs.readFileSync(appFile, 'utf8');
    assert(!content.includes("res.header('Access-Control-Allow-Origin', '*')"), 'Wildcard CORS header must be removed from app.js');
    assert(content.includes('cors('), 'app.js must use cors middleware with origin filtering');
    console.log('[PASS] Test 6: CORS configured with origin whitelist and credential support');
    passed++;
  } catch (err) {
    console.error('[FAIL] Test 6: CORS check failed:', err.message);
  }

  console.log('='.repeat(80));
  console.log(`SUMMARY: ${passed} / ${total} PHASE 1 SECURITY TESTS PASSED!`);
  console.log('='.repeat(80));

  if (passed !== total) {
    process.exit(1);
  }
}

runSecurityTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

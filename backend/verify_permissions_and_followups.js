require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Role = require('./src/models/Role');
const FollowUp = require('./src/models/FollowUp');
const Enquiry = require('./src/models/Enquiry');
const { authorize, requirePermission } = require('./src/middleware/auth');
const followUpController = require('./src/controllers/followUpController');

const mockResponse = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
};

(async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('Connected.');

    // 1. Verify authorize middleware logic with role codes and names
    console.log('\n--- 1. Testing authorize() middleware ---');
    const authMiddleware = authorize('SUPER_ADMIN', 'DIRECTOR', 'SA', 'DIR');
    
    const testCases = [
      { role: 'SA', expectedSuccess: true },
      { role: 'SUPER_ADMIN', expectedSuccess: true },
      { role: 'DIR', expectedSuccess: true },
      { role: 'DIRECTOR', expectedSuccess: true },
      { role: 'SALES', expectedSuccess: false },
      { role: 'DE', expectedSuccess: false }
    ];

    for (const tc of testCases) {
      const req = { user: { role: tc.role } };
      const res = mockResponse();
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      authMiddleware(req, res, next);

      if (tc.expectedSuccess && nextCalled) {
        console.log(`PASS: Role '${tc.role}' successfully authorized`);
      } else if (!tc.expectedSuccess && res.statusCode === 403) {
        console.log(`PASS: Role '${tc.role}' correctly rejected (403)`);
      } else {
        console.log(`FAIL: Role '${tc.role}' - Expected Success: ${tc.expectedSuccess}, Next Called: ${nextCalled}, Status Code: ${res.statusCode}`);
      }
    }

    // 2. Verify requirePermission middleware on 'Admin' / settings
    console.log('\n--- 2. Testing requirePermission() settings / Admin ---');
    const permMiddleware = requirePermission('Admin', 'edit');

    // Get a SALES user and a DIR user from DB to test with actual permissions
    const salesUser = await User.findOne({ role: 'SALES' });
    const dirUser = await User.findOne({ role: 'DIR' });
    const saUser = await User.findOne({ role: 'SA' });

    if (saUser) {
      const req = { user: saUser };
      const res = mockResponse();
      let nextCalled = false;
      await permMiddleware(req, res, () => { nextCalled = true; });
      console.log(`Super Admin (SA) check: ${nextCalled ? 'PASS' : 'FAIL'}`);
    }

    if (dirUser) {
      const req = { user: dirUser };
      const res = mockResponse();
      let nextCalled = false;
      
      // Test DIR lacks 'edit' Admin permission
      await permMiddleware(req, res, () => { nextCalled = true; });
      const editBlockedOk = (!nextCalled && res.statusCode === 403);
      
      // Test DIR has 'view' Admin permission
      const viewPermMiddleware = requirePermission('Admin', 'view');
      let viewNextCalled = false;
      const resView = mockResponse();
      await viewPermMiddleware(req, resView, () => { viewNextCalled = true; });

      console.log(`Director (DIR) check (blocked from Admin edit): ${editBlockedOk ? 'PASS' : 'FAIL'}`);
      console.log(`Director (DIR) check (allowed Admin view): ${viewNextCalled ? 'PASS' : 'FAIL'}`);
    }

    if (salesUser) {
      const req = { user: salesUser };
      const res = mockResponse();
      let nextCalled = false;
      await permMiddleware(req, res, () => { nextCalled = true; });
      console.log(`Sales Executive (SALES) check (should be blocked): ${!nextCalled && res.statusCode === 403 ? 'PASS' : 'FAIL'}`);
    }

    // 3. Verify nextFollowUpDate validation in followUpController
    console.log('\n--- 3. Testing past date validation on nextFollowUpDate ---');
    const dummyEnquiry = await Enquiry.findOne();
    if (!dummyEnquiry) {
      console.log('No enquiry found in database to simulate follow-up validation. Skipping controller validation check.');
    } else {
      const req = {
        user: saUser || { _id: new mongoose.Types.ObjectId(), role: 'SA' },
        body: {
          enquiryId: dummyEnquiry._id,
          notes: 'Test note',
          followUpDate: new Date(Date.now() - 86400000 * 2), // 2 days in the past
          nextFollowUpDate: new Date(Date.now() - 86400000) // 1 day in the past (before now, but after followUpDate)
        }
      };
      const res = mockResponse();
      let nextCalled = false;
      
      await followUpController.addFollowUp(req, res, (err) => { nextCalled = true; });

      if (res.statusCode === 400 && res.body?.message?.includes('cannot be in the past')) {
        console.log('PASS: Creating follow-up with past nextFollowUpDate was successfully rejected with 400 Bad Request');
      } else {
        console.log(`FAIL: Expected rejection 400, got status ${res.statusCode} and body:`, res.body);
      }
    }

    console.log('\nVerification completed.');
    process.exit(0);
  } catch (err) {
    console.error('Error during verification:', err);
    process.exit(1);
  }
})();

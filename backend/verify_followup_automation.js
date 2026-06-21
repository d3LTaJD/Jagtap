const mongoose = require('mongoose');
require('dotenv').config();

const SystemSettings = require('./src/models/SystemSettings');
const Enquiry = require('./src/models/Enquiry');
const FollowUp = require('./src/models/FollowUp');
const User = require('./src/models/User');
const Customer = require('./src/models/Customer');
const Notification = require('./src/models/Notification');
const { checkAutomatedReminders } = require('./src/services/enquiryScheduler');

async function run() {
  try {
    console.log("Connecting to Database...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected successfully to DB!");

    // 1. Setup temp test user
    let testUser = await User.findOne({ is_active: true });
    if (!testUser) {
      testUser = await User.create({
        name: 'Test Agent',
        mobile_number: '2222222222',
        email: 'testagent2@petrovalves.com',
        role: 'SALES',
        department: 'Sales',
        is_active: true,
        is_verified: true
      });
      console.log("Created temporary user.");
    }

    // 2. Setup temp test customer
    let testCustomer = await Customer.create({
      companyName: 'Test Automation Corp',
      emailAddress: 'test@automation.com',
      mobileNumber: '9999999999',
      sourceChannel: 'Email',
      primaryContactName: 'Test Contact'
    });
    console.log("Created temporary customer.");

    console.log("\n==================================================");
    console.log("TEST 1: Configurable Intervals in SystemSettings");
    console.log("==================================================");
    let settings = await SystemSettings.findOne({ _singleton: 'global' });
    if (!settings) {
      settings = await SystemSettings.create({ _singleton: 'global' });
    }
    settings.followupIntervals = [1, 3, 5];
    await settings.save();
    console.log("Successfully saved followupIntervals as [1, 3, 5]. Saved values:", settings.followupIntervals);

    console.log("\n==================================================");
    console.log("TEST 2: Auto D+3 Next Follow-Up Date on Blank Input");
    console.log("==================================================");
    // Create an enquiry first
    const enquiry = await Enquiry.create({
      enquiryId: 'ENQ-TEST-9999',
      customer: testCustomer._id,
      contactPerson: 'Test Contact',
      contactMobile: '9999999999',
      sourceChannel: 'Email',
      productCategory: 'Pressure Vessel',
      productDescription: 'Test vessel',
      quantity: 1,
      unit: 'NOS',
      priority: 'Medium',
      assignedTo: testUser._id,
      status: 'New'
    });
    console.log("Created test enquiry:", enquiry.enquiryId);

    // Call follow-up creation via controller simulation
    // Simulate req, res, next
    const followUpController = require('./src/controllers/followUpController');
    const mockReq = {
      body: {
        enquiryId: enquiry._id,
        notes: 'Simulated follow-up with blank nextFollowUpDate',
        type: 'CALL',
        followUpDate: new Date()
      },
      user: testUser
    };
    
    let responseData = null;
    const mockRes = {
      status: function(code) {
        return this;
      },
      json: function(obj) {
        responseData = obj;
        return this;
      }
    };

    console.log("Calling addFollowUp with blank nextFollowUpDate...");
    await followUpController.addFollowUp(mockReq, mockRes, (err) => {
      if (err) throw err;
    });

    console.log("Response data:", JSON.stringify(responseData, null, 2));
    
    // Check enquiry nextFollowUpDate
    const updatedEnq = await Enquiry.findById(enquiry._id);
    console.log("Enquiry lastFollowUpAt:", updatedEnq.lastFollowUpAt);
    console.log("Enquiry nextFollowUpDate:", updatedEnq.nextFollowUpDate);

    const timeDiff = updatedEnq.nextFollowUpDate - updatedEnq.lastFollowUpAt;
    const daysDiff = Math.round(timeDiff / (1000 * 60 * 60 * 24));
    console.log("Calculated days difference:", daysDiff);
    if (daysDiff === 3) {
      console.log("✅ SUCCESS: Auto D+3 calculation matches SOW rules!");
    } else {
      throw new Error(`Auto D+3 mismatch. Expected 3 days difference, got ${daysDiff}`);
    }

    console.log("\n==================================================");
    console.log("TEST 3: Automated Reminders Scheduler Execution (D+1)");
    console.log("==================================================");
    // Backdate the lastFollowUpAt of the enquiry by exactly 1 day (matching D+1 in our configuration [1, 3, 5])
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    updatedEnq.lastFollowUpAt = yesterday;
    updatedEnq.createdAt = yesterday; // fallback
    updatedEnq.nextFollowUpDate = null; // reset to check trigger
    await updatedEnq.save();

    console.log("Set enquiry lastFollowUpAt to:", yesterday);

    // Clean any prior notification of type FOLLOWUP_REMINDER for this enquiry
    await Notification.deleteMany({ related_id: enquiry._id });

    console.log("Running scheduler checkAutomatedReminders()...");
    await checkAutomatedReminders();

    // Check if nextFollowUpDate was updated to today and notification generated
    const checkEnq = await Enquiry.findById(enquiry._id);
    const today = new Date();
    today.setHours(0,0,0,0);
    const enqDueDateOnly = new Date(checkEnq.nextFollowUpDate);
    enqDueDateOnly.setHours(0,0,0,0);

    if (enqDueDateOnly.getTime() === today.getTime()) {
      console.log("✅ SUCCESS: nextFollowUpDate successfully moved to today!");
    } else {
      throw new Error(`Enquiry nextFollowUpDate not set to today. Got: ${checkEnq.nextFollowUpDate}`);
    }

    const notif = await Notification.findOne({ related_id: enquiry._id, type: 'FOLLOWUP_REMINDER' });
    if (notif) {
      console.log("✅ SUCCESS: Notification correctly generated in database:", notif.title);
    } else {
      throw new Error("No followup reminder notification found in database!");
    }

    console.log("\n==================================================");
    console.log("TEST 4: Dashboard Follow-up Queue Retrieval");
    console.log("==================================================");
    // Call getDashboardStats controller logic simulation
    const dashboardController = require('./src/controllers/dashboardController');
    const mockDashReq = {
      user: testUser
    };
    let dashResponseData = null;
    const mockDashRes = {
      status: function(code) {
        return this;
      },
      json: function(obj) {
        dashResponseData = obj;
        return this;
      }
    };

    console.log("Querying dashboard statistics...");
    await dashboardController.getDashboardStats(mockDashReq, mockDashRes, (err) => {
      if (err) throw err;
    });

    const followUpsQueue = dashResponseData?.data?.myTasks?.followUps || [];
    console.log("Follow-up queue returned", followUpsQueue.length, "items.");
    const matchingItem = followUpsQueue.find(item => item.enquiry?.enquiryId === enquiry.enquiryId);
    if (matchingItem) {
      console.log("✅ SUCCESS: Enquiry found in the active follow-up queue:", JSON.stringify(matchingItem, null, 2));
    } else {
      throw new Error("Enquiry not found in user's dashboard follow-up queue!");
    }

    console.log("\n==================================================");
    console.log("TEST 5: Quick Reschedule (Postpone) simulation");
    console.log("==================================================");
    const tomorrow2 = new Date();
    tomorrow2.setDate(tomorrow2.getDate() + 2);

    const mockPostponeReq = {
      body: {
        enquiryId: enquiry._id,
        notes: 'Quick postpone by 2 days',
        type: 'NOTE',
        nextFollowUpDate: tomorrow2.toISOString().split('T')[0]
      },
      user: testUser
    };

    let postponeResponseData = null;
    const mockPostponeRes = {
      status: function(code) {
        return this;
      },
      json: function(obj) {
        postponeResponseData = obj;
        return this;
      }
    };

    await followUpController.addFollowUp(mockPostponeReq, mockPostponeRes, (err) => {
      if (err) throw err;
    });

    // Verify it is cleared from the queue (i.e., nextFollowUpDate is in the future)
    await dashboardController.getDashboardStats(mockDashReq, mockDashRes, (err) => {
      if (err) throw err;
    });
    
    const refreshedQueue = mockDashRes.json.caller ? [] : (dashResponseData?.data?.myTasks?.followUps || []);
    const foundAfterPostpone = refreshedQueue.find(item => item.enquiry?.enquiryId === enquiry.enquiryId);
    if (!foundAfterPostpone) {
      console.log("✅ SUCCESS: Enquiry successfully cleared from the daily follow-up queue after postpone!");
    } else {
      throw new Error("Enquiry is still present in the daily queue despite being rescheduled to a future date!");
    }

    // Cleanup
    console.log("\nCleaning up test records...");
    await Enquiry.deleteOne({ _id: enquiry._id });
    await FollowUp.deleteMany({ enquiry: enquiry._id });
    await Customer.deleteOne({ _id: testCustomer._id });
    await Notification.deleteMany({ related_id: enquiry._id });
    if (testUser.email === 'testagent2@petrovalves.com') {
      await User.deleteOne({ _id: testUser._id });
    }
    
    // Restore settings intervals default
    settings.followupIntervals = [1, 3, 7];
    await settings.save();
    console.log("Restored settings intervals default.");

    console.log("Cleanup complete!");
    console.log("\n==================================================");
    console.log("ALL TESTS COMPLETED SUCCESSFULLY!");
    console.log("==================================================");
    process.exit(0);

  } catch (err) {
    console.error("Test failed with error:", err.message);
    process.exit(1);
  }
}

run();

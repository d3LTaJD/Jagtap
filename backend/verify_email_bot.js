const mongoose = require('mongoose');
require('dotenv').config();

const aiService = require('./src/services/aiService');
const emailBotService = require('./src/services/emailBotService');
const Customer = require('./src/models/Customer');
const Enquiry = require('./src/models/Enquiry');
const User = require('./src/models/User');
const Task = require('./src/models/Task');

async function run() {
  try {
    console.log("Connecting to Database...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected successfully to DB!");

    // Ensure we have at least one active user for assignment
    let testUser = await User.findOne({ is_active: true });
    if (!testUser) {
      console.log("No active user found. Creating a temporary test user...");
      testUser = await User.create({
        name: 'Test Agent',
        mobile_number: '1111111111',
        email: 'testagent@petrovalves.com',
        role: 'SUPER_ADMIN',
        department: 'Sales',
        is_active: true,
        is_verified: true
      });
      console.log(`Created test user: ${testUser.email}`);
    } else {
      console.log(`Using active user for assignment: ${testUser.name} (${testUser.role})`);
    }

    console.log("\n==================================================");
    console.log("TEST 1: AI Extraction (aiService.js)");
    console.log("==================================================");
    const mockEmailText = `
Hi Petro Valve Team,

We are looking for a quote on the following requirement:
- Ball Valves, size 2 inch, Class 150 - 50 Pieces.
- ASME Standard specification.
Material: SS316.
Delivery required within 4 weeks.

Please share pricing and lead time ASAP as this is very urgent.

Thanks,
Vikram Singh
Procurement Manager
Reliance Industries Ltd
Mobile: +91 9820098200
v.singh@ril.com
    `;

    console.log("Extracting data from mock email text...");
    const extractedData = await aiService.extractEnquiryDetails(mockEmailText, {
      from: '"Vikram Singh" <v.singh@ril.com>',
      subject: "Enquiry for Ball Valves - Reliance Industries"
    });

    console.log("Extracted structured data result:", JSON.stringify(extractedData, null, 2));

    console.log("\n==================================================");
    console.log("TEST 2: Database Insertion & Auto-Reply (emailBotService.js)");
    console.log("==================================================");
    
    // Check if the mock customer already exists, delete it so we can test the creation flow cleanly
    const testEmail = 'jeetdodia12@gmail.com';
    await Customer.deleteOne({ emailAddress: testEmail });
    
    // Construct mock parsed email object for simpleParser
    const mockParsedEmail = {
      from: {
        text: '"Vikram Singh" <jeetdodia12@gmail.com>',
        value: [{ address: 'jeetdodia12@gmail.com', name: 'Vikram Singh' }]
      },
      subject: "Enquiry for Ball Valves - Reliance Industries",
      text: mockEmailText
    };

    console.log("Simulating processEmailMessage with parsed email...");
    await emailBotService.processEmailMessage(mockParsedEmail);

    // Fetch the newly created Customer and Enquiry
    const customerRecord = await Customer.findOne({ emailAddress: testEmail });
    if (!customerRecord) {
      throw new Error(`Failed to auto-create Customer for ${testEmail}`);
    }
    console.log("\nCreated Customer Record:\n", JSON.stringify(customerRecord, null, 2));

    const enquiryRecord = await Enquiry.findOne({ customer: customerRecord._id });
    if (!enquiryRecord) {
      throw new Error(`Failed to auto-create Enquiry for Customer ${customerRecord._id}`);
    }
    console.log("\nCreated Enquiry Record:\n", JSON.stringify(enquiryRecord, null, 2));

    // Verify task generation
    const taskRecord = await Task.findOne({ linkedEnquiry: enquiryRecord._id });
    if (taskRecord) {
      console.log("\nCreated Task Record:\n", JSON.stringify(taskRecord, null, 2));
    } else {
      console.log("\nWarning: No follow-up task was generated for the enquiry.");
    }

    // Cleaning up mock records from DB
    console.log("\nCleaning up test records from database...");
    await Enquiry.deleteOne({ _id: enquiryRecord._id });
    await Customer.deleteOne({ _id: customerRecord._id });
    if (taskRecord) {
      await Task.deleteOne({ _id: taskRecord._id });
    }
    if (testUser.email === 'testagent@petrovalves.com') {
      await User.deleteOne({ _id: testUser._id });
      console.log("Deleted temporary test user.");
    }
    console.log("Cleanup complete!");

    console.log("\nVerification finished successfully!");
    process.exit(0);
  } catch (err) {
    console.error("\nVerification failed with error:", err);
    process.exit(1);
  }
}

run();

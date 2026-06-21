const mongoose = require('mongoose');
require('dotenv').config();

// Ensure all schema dependencies are registered
const Attachment = require('./src/models/Attachment');
const FileMetadata = require('./src/models/FileMetadata');
const Enquiry = require('./src/models/Enquiry');
const Customer = require('./src/models/Customer');
const User = require('./src/models/User');
const FieldDefinition = require('./src/models/FieldDefinition');
const Quotation = require('./src/models/Quotation');
const Task = require('./src/models/Task');
const Notification = require('./src/models/Notification');

const enquiryController = require('./src/controllers/enquiryController');
const quotationController = require('./src/controllers/quotationController');

// Mock response helper
function createMockResponse() {
  return {
    statusCode: 200,
    responseData: null,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(obj) {
      this.responseData = obj;
      return this;
    }
  };
}

// Mock request helper to avoid Audit Log TypeError: req.get is not a function
function createMockRequest(body, user, params = {}) {
  return {
    body,
    user,
    params,
    ip: '127.0.0.1',
    get: function(header) {
      if (header && header.toLowerCase() === 'user-agent') {
        return 'Pipeline-Verification-Agent';
      }
      return null;
    }
  };
}

async function run() {
  let testUser = null;
  let testCustomer = null;
  let testField = null;
  const createdEnquiries = [];
  const createdQuotations = [];

  try {
    console.log("Connecting to Database...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected successfully to DB!");

    // 1. Setup temporary test user
    testUser = await User.findOne({ is_active: true });
    if (!testUser) {
      testUser = await User.create({
        name: 'Test Agent Pipeline',
        mobile_number: '3333333333',
        email: 'testagent_pipeline@petrovalves.com',
        role: 'SALES',
        department: 'Sales',
        is_active: true,
        is_verified: true
      });
      console.log("Created temporary user.");
    } else {
      console.log(`Using existing user: ${testUser.email}`);
    }

    // 2. Setup temporary test customer
    testCustomer = await Customer.create({
      companyName: 'Test Pipeline Corp',
      emailAddress: 'pipeline@testcorp.com',
      mobileNumber: '8888888888',
      sourceChannel: 'Email',
      primaryContactName: 'Pipeline Contact'
    });
    console.log("Created temporary customer.");

    // 3. Setup temporary FieldDefinition for completeness check
    // We target category 'PipelineTestCategory' to isolate from other pre-seeded fields
    testField = await FieldDefinition.create({
      formContext: 'Enquiry',
      productCategory: 'PipelineTestCategory',
      fieldName: 'temp_pipeline_spec',
      fieldLabel: 'Temp Pipeline Spec',
      fieldType: 'Text (Short)',
      isRequired: true,
      conditionalLogic: { dependsOnField: 'standardCode', requiredValue: 'ASME' },
      isActive: true,
      isDeleted: false
    });
    console.log("Created temporary required FieldDefinition under 'PipelineTestCategory' category.");

    console.log("\n==================================================");
    console.log("TEST 1: Create Enquiry with Incomplete Specs -> status: 'New'");
    console.log("==================================================");

    const reqCreate = createMockRequest(
      {
        customerData: { _id: testCustomer._id },
        enquiryData: {
          contactPerson: 'Pipeline Contact',
          contactMobile: '8888888888',
          sourceChannel: 'Email',
          productCategory: 'PipelineTestCategory',
          productDescription: 'Custom Equipment Spec',
          quantity: 1,
          unit: 'NOS',
          priority: 'Medium',
          standardCode: 'ASME',
          dynamicFields: {} // Incomplete: missing 'temp_pipeline_spec'
        }
      },
      testUser
    );

    const resCreate = createMockResponse();
    await enquiryController.createEnquiry(reqCreate, resCreate, (err) => {
      if (err) throw err;
    });

    if (resCreate.statusCode !== 201) {
      throw new Error(`Failed to create enquiry. Status: ${resCreate.statusCode}, Msg: ${JSON.stringify(resCreate.responseData)}`);
    }

    const enquiry1 = resCreate.responseData.data.enquiry;
    createdEnquiries.push(enquiry1._id);
    console.log(`Created Enquiry ${enquiry1.enquiryId}. Initial Status: '${enquiry1.status}'`);

    if (enquiry1.status === 'New') {
      console.log("✅ SUCCESS: Enquiry status is correctly initialized to 'New' when specs are incomplete.");
    } else {
      throw new Error(`Expected initial status 'New', got '${enquiry1.status}'`);
    }

    console.log("\n==================================================");
    console.log("TEST 2: Update Enquiry with Complete Specs -> status: 'Confirmed'");
    console.log("==================================================");

    const reqUpdate = createMockRequest(
      {
        dynamicFields: {
          temp_pipeline_spec: 'Completed Pipeline Value'
        }
      },
      testUser,
      { id: enquiry1._id }
    );

    const resUpdate = createMockResponse();
    await enquiryController.updateEnquiry(reqUpdate, resUpdate, (err) => {
      if (err) throw err;
    });

    if (resUpdate.statusCode !== 200) {
      throw new Error(`Failed to update enquiry. Status: ${resUpdate.statusCode}, Msg: ${JSON.stringify(resUpdate.responseData)}`);
    }

    const enquiry1Updated = await Enquiry.findById(enquiry1._id);
    console.log(`Enquiry ${enquiry1Updated.enquiryId} updated. New Status: '${enquiry1Updated.status}'`);

    const checkCompletion = await enquiryController.checkEnquiryCompletion(enquiry1Updated);
    console.log("Completion check results:", checkCompletion);

    if (enquiry1Updated.status === 'Confirmed') {
      console.log("✅ SUCCESS: Enquiry successfully auto-promoted to 'Confirmed' after filling required specs.");
    } else {
      throw new Error(`Expected auto-promoted status 'Confirmed', got '${enquiry1Updated.status}'. Missing fields: ${JSON.stringify(checkCompletion.missingFields)}`);
    }

    console.log("\n==================================================");
    console.log("TEST 3: Quotation Generation Block & Success Rules");
    console.log("==================================================");

    // Create a new incomplete enquiry in 'New' status
    const reqCreateNew = createMockRequest(
      {
        customerData: { _id: testCustomer._id },
        enquiryData: {
          contactPerson: 'Pipeline Contact',
          contactMobile: '8888888888',
          sourceChannel: 'Email',
          productCategory: 'PipelineTestCategory',
          productDescription: 'Custom Equipment Spec 2',
          quantity: 2,
          unit: 'NOS',
          priority: 'Medium',
          standardCode: 'ASME',
          dynamicFields: {} // Incomplete
        }
      },
      testUser
    );

    const resCreateNew = createMockResponse();
    await enquiryController.createEnquiry(reqCreateNew, resCreateNew, (err) => {
      if (err) throw err;
    });

    const enquiry2 = resCreateNew.responseData.data.enquiry;
    createdEnquiries.push(enquiry2._id);
    console.log(`Created second Enquiry ${enquiry2.enquiryId} in status: '${enquiry2.status}'`);

    // A. Attempt quotation creation on 'New' -> Should be blocked!
    const reqQuoteBlocked = createMockRequest(
      {
        enquiry: enquiry2._id,
        items: [
          {
            itemNo: 1,
            description: 'Item spec',
            quantity: 2,
            unit: 'NOS',
            unitPrice: 10000,
            lineTotalExclGST: 20000,
            lineTotalInclGST: 23600
          }
        ]
      },
      testUser
    );

    const resQuoteBlocked = createMockResponse();
    await quotationController.createQuotation(reqQuoteBlocked, resQuoteBlocked, (err) => {
      if (err) throw err;
    });

    console.log("Quotation creation result on 'New':", resQuoteBlocked.statusCode, resQuoteBlocked.responseData?.message);
    if (resQuoteBlocked.statusCode === 400 && resQuoteBlocked.responseData?.message.includes("blocked")) {
      console.log("✅ SUCCESS: Quotation creation was successfully blocked for 'New' enquiry.");
    } else {
      throw new Error(`Expected quotation creation to be blocked (400), but got status: ${resQuoteBlocked.statusCode}`);
    }

    // B. Promote the enquiry status to 'Technical Review' and retry
    console.log("Manually setting enquiry status to 'Technical Review'...");
    enquiry2.status = 'Technical Review';
    await enquiry2.save();

    const resQuoteSuccess = createMockResponse();
    await quotationController.createQuotation(reqQuoteBlocked, resQuoteSuccess, (err) => {
      if (err) throw err;
    });

    if (resQuoteSuccess.statusCode === 201 || resQuoteSuccess.statusCode === 200) {
      const createdQuote = resQuoteSuccess.responseData.data || resQuoteSuccess.responseData.quotation;
      if (createdQuote && createdQuote._id) {
        createdQuotations.push(createdQuote._id);
      }
      console.log("✅ SUCCESS: Quotation was successfully created for 'Technical Review' enquiry.");
    } else {
      throw new Error(`Expected quotation creation to succeed, but failed with status: ${resQuoteSuccess.statusCode}, Msg: ${JSON.stringify(resQuoteSuccess.responseData)}`);
    }

    // C. Verify the enquiry status transitioned to 'Quoted'
    const enquiry2PostQuote = await Enquiry.findById(enquiry2._id);
    console.log(`Enquiry ${enquiry2PostQuote.enquiryId} status after quotation: '${enquiry2PostQuote.status}'`);
    if (enquiry2PostQuote.status === 'Quoted') {
      console.log("✅ SUCCESS: Enquiry status successfully moved to 'Quoted' upon quotation generation.");
    } else {
      throw new Error(`Expected enquiry status to transition to 'Quoted', got '${enquiry2PostQuote.status}'`);
    }

    console.log("\n==================================================");
    console.log("TEST 4: Manual Verification Sets Status to Confirmed");
    console.log("==================================================");

    // Create another enquiry
    const resCreateNew3 = createMockResponse();
    await enquiryController.createEnquiry(reqCreateNew, resCreateNew3, (err) => {
      if (err) throw err;
    });

    const enquiry3 = resCreateNew3.responseData.data.enquiry;
    createdEnquiries.push(enquiry3._id);
    console.log(`Created third Enquiry ${enquiry3.enquiryId} in status: '${enquiry3.status}'`);

    const reqVerify = createMockRequest(
      {
        updatedFields: {
          dynamicFields: {
            temp_pipeline_spec: 'Verified Pipeline Value'
          }
        },
        reviewNotes: 'Verified during pipeline test run'
      },
      testUser,
      { id: enquiry3._id }
    );

    const resVerify = createMockResponse();
    await enquiryController.verifyAndApproveEnquiry(reqVerify, resVerify, (err) => {
      if (err) throw err;
    });

    if (resVerify.statusCode !== 200) {
      throw new Error(`Failed manual verification. Status: ${resVerify.statusCode}, Msg: ${JSON.stringify(resVerify.responseData)}`);
    }

    const enquiry3Verified = await Enquiry.findById(enquiry3._id);
    console.log(`Enquiry ${enquiry3Verified.enquiryId} verified. Status: '${enquiry3Verified.status}', isUnverified: ${enquiry3Verified.isUnverified}`);

    if (enquiry3Verified.status === 'Confirmed' && !enquiry3Verified.isUnverified) {
      console.log("✅ SUCCESS: Manual verification successfully set status to 'Confirmed' and marked it verified.");
    } else {
      throw new Error(`Expected status 'Confirmed' and isUnverified=false, got status '${enquiry3Verified.status}' and isUnverified=${enquiry3Verified.isUnverified}`);
    }

  } catch (error) {
    console.error("\n❌ VERIFICATION TEST FAILED:", error);
    process.exitCode = 1;
  } finally {
    console.log("\nCleaning up test records...");

    // Clean up quotations
    if (createdQuotations.length > 0) {
      const deleteQuoteResult = await Quotation.deleteMany({ _id: { $in: createdQuotations } });
      console.log(`Deleted ${deleteQuoteResult.deletedCount} test quotations.`);
    }

    // Clean up enquiries
    if (createdEnquiries.length > 0) {
      const deleteEnqResult = await Enquiry.deleteMany({ _id: { $in: createdEnquiries } });
      console.log(`Deleted ${deleteEnqResult.deletedCount} test enquiries.`);
      
      // Clean up linked notifications & tasks
      const deleteNotifResult = await Notification.deleteMany({ related_id: { $in: createdEnquiries } });
      console.log(`Deleted ${deleteNotifResult.deletedCount} test notifications.`);

      const deleteTaskResult = await Task.deleteMany({ linkedEnquiry: { $in: createdEnquiries } });
      console.log(`Deleted ${deleteTaskResult.deletedCount} test tasks.`);
    }

    // Clean up field definition
    if (testField) {
      await FieldDefinition.deleteOne({ _id: testField._id });
      console.log("Deleted temporary FieldDefinition.");
    }

    // Clean up customer
    if (testCustomer) {
      await Customer.deleteOne({ _id: testCustomer._id });
      console.log("Deleted temporary Customer.");
    }

    // Clean up user if created
    if (testUser && testUser.email === 'testagent_pipeline@petrovalves.com') {
      await User.deleteOne({ _id: testUser._id });
      console.log("Deleted temporary User.");
    }

    await mongoose.connection.close();
    console.log("Database connection closed.");

    if (process.exitCode === 1) {
      console.log("\n❌ VERIFICATION RUN FAILED. Review errors above.");
    } else {
      console.log("\n✨ ALL PIPELINE VERIFICATIONS PASSED SUCCESSFULLY!");
    }
    process.exit(process.exitCode || 0);
  }
}

run();

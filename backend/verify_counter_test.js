const mongoose = require('mongoose');
require('dotenv').config();

const { getNextSequenceValue } = require('./src/utils/counter');

async function run() {
  try {
    console.log("Connecting to Database...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected successfully!");

    const testPrefix = `TEST-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-`;
    
    console.log(`Starting concurrent calls for sequence: ${testPrefix}`);
    // Run 5 calls concurrently
    const promises = [
      getNextSequenceValue(testPrefix),
      getNextSequenceValue(testPrefix),
      getNextSequenceValue(testPrefix),
      getNextSequenceValue(testPrefix),
      getNextSequenceValue(testPrefix)
    ];

    const results = await Promise.all(promises);
    console.log("Concurrent Results:", results);

    // Verify they are sequential numbers
    const sorted = [...results].sort((a, b) => a - b);
    console.log("Sorted Results:", sorted);

    // Clean up test sequence document
    const Counter = require('./src/models/Counter');
    await Counter.deleteOne({ _id: testPrefix });
    console.log("Test document cleaned up.");

    console.log("Verification finished successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Verification failed:", err);
    process.exit(1);
  }
}

run();

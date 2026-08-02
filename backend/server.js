require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');
const { initCronJobs } = require('./src/cronJobs');
const emailBotService = require('./src/services/emailBotService');
const { startQueueWorker } = require('./src/services/queueService');
require('./src/services/queueHandlers'); // Register background queue handlers on startup

const PORT = process.env.PORT || 5000;

// Global error handlers — prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err.message);
  console.error(err.stack);
  // Don't exit — keep server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Promise Rejection at:', promise);
  console.error('[FATAL] Reason:', reason?.message || reason);
  if (reason?.stack) console.error(reason.stack);
  // Don't exit — keep server running
});

// Connect to database then start server
connectDB().then(async () => {
  // Clear any stuck processing states from previous server runs
  try {
    const Enquiry = require('./src/models/Enquiry');
    const EmailMessage = require('./src/models/EmailMessage');
    const Attachment = require('./src/models/Attachment');

    await Promise.all([
      Enquiry.updateMany(
        { processingStatus: { $in: ['Pending', 'Processing'] } },
        { $set: { processingStatus: 'Completed', processingMessage: '' } }
      ),
      EmailMessage.updateMany(
        { processingStatus: { $in: ['Pending', 'Processing'] } },
        { $set: { processingStatus: 'Completed' } }
      ),
      Attachment.updateMany(
        { processingStatus: { $in: ['Pending', 'Processing'] } },
        { $set: { processingStatus: 'Completed' } }
      )
    ]);
    console.log('[Startup] Cleared any stuck AI processing queue states.');
  } catch (clearErr) {
    console.error('[Startup] Failed to clear stuck processing states:', clearErr.message);
  }

  initCronJobs();
  const LearningEngine = require('./src/services/extraction/LearningEngine');
  await LearningEngine.init();
  emailBotService.start();
  startQueueWorker();
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
}).catch((err) => {
  console.error('[FATAL] Failed to connect to database:', err.message);
  process.exit(1);
});

require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');
const { initCronJobs } = require('./src/cronJobs');
const emailBotService = require('./src/services/emailBotService');

const PORT = process.env.PORT || 5000;

// Connect to database then start server
connectDB().then(() => {
  initCronJobs();
  emailBotService.start();
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
});


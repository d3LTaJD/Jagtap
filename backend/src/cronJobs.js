const cron = require('node-cron');
const FollowUp = require('./models/FollowUp');
const { createNotification } = require('./services/notificationService');
const { startEnquiryScheduler } = require('./services/enquiryScheduler');

exports.initCronJobs = () => {
  console.log('Cron jobs initialized');

  // SOW 5.4 — Enquiry Alerts & Automation engine
  startEnquiryScheduler();
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();

      const dueFollowUps = await FollowUp.find({
        nextFollowUpDate: { $lte: now },
        reminderSent: false
      }).populate('enquiry', 'enquiryId assignedTo');

      for (const f of dueFollowUps) {
        // Notification for the assigned user of the Enquiry (or the one who conducted it)
        const notifyUserId = f.enquiry?.assignedTo || f.addedBy;

        await createNotification({
          user_id: notifyUserId,
          type: 'FOLLOWUP_REMINDER',
          title: 'Follow-up Due',
          message: `Your follow-up for Enquiry ${f.enquiry?.enquiryId || 'Unknown'} is due now.`,
          related_id: f.enquiry?._id
        });

        f.reminderSent = true;
        await f.save();
      }

    } catch (err) {
      console.error('Error in cron job checking follow-ups:', err);
    }
  });
  // Daily Backup Cron (Run at midnight: 0 0 * * *)
  cron.schedule('0 0 * * *', async () => {
    try {
      const { runDailyBackup } = require('./services/backupService');
      await runDailyBackup();
    } catch (err) {
      console.error('Error in daily backup cron:', err);
    }
  });
};

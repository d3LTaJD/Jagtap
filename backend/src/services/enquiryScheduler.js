/**
 * SOW 5.4 — Enquiry Alerts & Automation (Scheduled Jobs)
 * 
 * Runs every hour via node-cron and checks for:
 *   1. Uncontacted enquiries older than 4 hours → push to assigned user
 *   2. Follow-up date reached today → push + email to assigned user
 *   3. Idle enquiries (no update for 5+ days) → escalate to Director
 *   4. Idle enquiries (no update for 60+ days) → auto-abandon
 */

const cron = require('node-cron');
const Enquiry = require('../models/Enquiry');
const SystemSettings = require('../models/SystemSettings');
const { createNotification, notifyRoles, sendEmail } = require('./notificationService');
const { logActivity } = require('../utils/logger');

// ─── 1. Uncontacted > 4 hours ──────────────────────────────────────────────
async function checkUncontacted() {
  try {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const enquiries = await Enquiry.find({
      status: 'New',
      createdAt: { $lt: fourHoursAgo },
      assignedTo: { $ne: null }
    }).populate('customer', 'companyName');

    for (const enq of enquiries) {
      await createNotification({
        user_id: enq.assignedTo,
        type: 'REMINDER',
        title: '⏰ Enquiry Not Yet Contacted',
        message: `Reminder: Enquiry ${enq.enquiryId} (${enq.customer?.companyName || 'Unknown'}) has not been contacted yet — created ${Math.round((Date.now() - enq.createdAt) / 3600000)}h ago.`,
        related_id: enq._id
      });
    }

    if (enquiries.length > 0) {
      console.log(`[Scheduler] Sent ${enquiries.length} uncontacted reminder(s).`);
    }
  } catch (err) {
    console.error('[Scheduler] checkUncontacted error:', err.message);
  }
}

// ─── 2. Follow-up date reached ─────────────────────────────────────────────
async function checkFollowUps() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const enquiries = await Enquiry.find({
      nextFollowUpDate: { $gte: today, $lt: tomorrow },
      status: { $nin: ['Won', 'Lost', 'Abandoned'] },
      assignedTo: { $ne: null }
    }).populate('customer', 'companyName');

    for (const enq of enquiries) {
      await createNotification({
        user_id: enq.assignedTo,
        type: 'FOLLOW_UP',
        title: '📋 Follow-up Due Today',
        message: `Follow-up due for ${enq.enquiryId} — ${enq.customer?.companyName || 'Unknown'}. Review and update status.`,
        related_id: enq._id
      });

      // Also send email
      await sendEmail({
        userId: enq.assignedTo,
        subject: `Follow-up Due: ${enq.enquiryId}`,
        text: `Hi,\n\nYour follow-up for enquiry ${enq.enquiryId} (${enq.customer?.companyName || 'Customer'}) is due today.\n\nProduct: ${enq.productCategory}\nStatus: ${enq.status}\n\nPlease log in and update the enquiry.\n\n— System Alert`
      });
    }

    if (enquiries.length > 0) {
      console.log(`[Scheduler] Sent ${enquiries.length} follow-up reminder(s).`);
    }
  } catch (err) {
    console.error('[Scheduler] checkFollowUps error:', err.message);
  }
}

// ─── 3. Idle > 5 days — Escalation to Director ─────────────────────────────
async function checkIdleEscalation() {
  try {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

    const enquiries = await Enquiry.find({
      updatedAt: { $lt: fiveDaysAgo },
      status: { $nin: ['Won', 'Lost', 'Abandoned', 'On Hold'] },
      assignedTo: { $ne: null }
    }).populate('customer', 'companyName');

    for (const enq of enquiries) {
      // Notify assigned user
      await createNotification({
        user_id: enq.assignedTo,
        type: 'ESCALATION',
        title: '⚠️ Enquiry Idle — Escalation Alert',
        message: `Enquiry ${enq.enquiryId} has had no activity for ${Math.floor((Date.now() - enq.updatedAt) / 86400000)} days. Please update or close.`,
        related_id: enq._id
      });

      // Escalate to Director
      await notifyRoles({
        roles: ['DIR', 'DIRECTOR'],
        type: 'ESCALATION',
        title: '⚠️ Enquiry Escalation — No Activity',
        message: `Enquiry ${enq.enquiryId} (${enq.customer?.companyName || 'Unknown'}) has been idle for ${Math.floor((Date.now() - enq.updatedAt) / 86400000)} days. Action required.`,
        related_id: enq._id
      });

      // Send email to assigned user
      await sendEmail({
        userId: enq.assignedTo,
        subject: `Escalation: Enquiry ${enq.enquiryId} — No activity for 5+ days`,
        text: `Hi,\n\nEnquiry ${enq.enquiryId} (${enq.customer?.companyName || 'Customer'}) has had no activity for over 5 days.\n\nCurrent Status: ${enq.status}\nProduct: ${enq.productCategory}\n\nPlease update the enquiry or mark it as On Hold / Lost.\n\n— System Alert`
      });
    }

    if (enquiries.length > 0) {
      console.log(`[Scheduler] Escalated ${enquiries.length} idle enquiry(ies) to Director.`);
    }
  } catch (err) {
    console.error('[Scheduler] checkIdleEscalation error:', err.message);
  }
}

// ─── 4. Idle > 60 days — Auto-Abandon ──────────────────────────────────────
async function autoAbandon() {
  try {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const enquiries = await Enquiry.find({
      updatedAt: { $lt: sixtyDaysAgo },
      status: { $nin: ['Won', 'Lost', 'Abandoned'] }
    }).populate('customer', 'companyName');

    for (const enq of enquiries) {
      enq.status = 'Abandoned';
      enq.lastModifiedBy = null; // System action
      await enq.save();

      // Notify Director
      await notifyRoles({
        roles: ['DIR', 'DIRECTOR'],
        type: 'SYSTEM',
        title: '🗂️ Enquiry Auto-Abandoned',
        message: `Enquiry ${enq.enquiryId} (${enq.customer?.companyName || 'Unknown'}) was auto-abandoned — no activity for 60+ days.`,
        related_id: enq._id
      });

      console.log(`[Scheduler] Auto-abandoned: ${enq.enquiryId}`);
    }

    if (enquiries.length > 0) {
      console.log(`[Scheduler] Auto-abandoned ${enquiries.length} stale enquiry(ies).`);
    }
  } catch (err) {
    console.error('[Scheduler] autoAbandon error:', err.message);
  }
}

// ─── 5. Configurable D+1, D+3, D+7 Automated Reminders ─────────────────────────
async function checkAutomatedReminders() {
  try {
    const settings = await SystemSettings.findOne({ _singleton: 'global' });
    const intervals = settings?.followupIntervals || [1, 3, 7];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const enquiries = await Enquiry.find({
      status: { $nin: ['Won', 'Lost', 'Abandoned'] },
      assignedTo: { $ne: null }
    }).populate('customer', 'companyName');

    let reminderCount = 0;

    for (const enq of enquiries) {
      const baseDate = enq.lastFollowUpAt || enq.createdAt;
      const baseDateOnly = new Date(baseDate);
      baseDateOnly.setHours(0, 0, 0, 0);

      const diffTime = today - baseDateOnly;
      if (diffTime < 0) continue; // Future activity? Skip.

      const daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (intervals.includes(daysElapsed)) {
        // Automatically move nextFollowUpDate to today so it appears in the daily queue
        enq.nextFollowUpDate = today;
        await enq.save();

        // Send push notification/in-app notification
        await createNotification({
          user_id: enq.assignedTo,
          type: 'FOLLOWUP_REMINDER',
          title: `⏰ D+${daysElapsed} Follow-up Due`,
          message: `Automated Reminder: Enquiry ${enq.enquiryId} (${enq.customer?.companyName || 'Unknown'}) has been idle for ${daysElapsed} days since last activity/creation.`,
          related_id: enq._id
        });

        // Send email notification
        await sendEmail({
          userId: enq.assignedTo,
          subject: `Automated Follow-up Reminder (D+${daysElapsed}): ${enq.enquiryId}`,
          text: `Hi,\n\nThis is an automated reminder that Enquiry ${enq.enquiryId} (${enq.customer?.companyName || 'Customer'}) is due for follow-up today (D+${daysElapsed} since last follow-up/creation).\n\nProduct: ${enq.productCategory}\nStatus: ${enq.status}\n\nPlease update the status or log a follow-up directly.\n\n— System Automation`
        });

        reminderCount++;
      }
    }

    if (reminderCount > 0) {
      console.log(`[Scheduler] Triggered ${reminderCount} automated follow-up reminder(s) based on intervals: [${intervals.join(', ')}].`);
    }
  } catch (err) {
    console.error('[Scheduler] checkAutomatedReminders error:', err.message);
  }
}

// ─── Start the scheduler ────────────────────────────────────────────────────
function startEnquiryScheduler() {
  console.log('[Scheduler] Enquiry Alerts & Automation engine started.');

  // Run every hour at :00
  cron.schedule('0 * * * *', async () => {
    console.log(`[Scheduler] Running hourly checks at ${new Date().toISOString()}`);
    await checkUncontacted();
    await checkFollowUps();
  });

  // Run daily at 9:00 AM IST (03:30 UTC)
  cron.schedule('30 3 * * *', async () => {
    console.log(`[Scheduler] Running daily checks at ${new Date().toISOString()}`);
    await checkIdleEscalation();
    await autoAbandon();
    await checkAutomatedReminders();
  });
}

module.exports = { startEnquiryScheduler, checkAutomatedReminders };

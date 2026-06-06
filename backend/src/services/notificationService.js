const Notification = require('../models/Notification');
const nodemailer = require('nodemailer');

const User = require('../models/User');
const Role = require('../models/Role');

// Nodemailer removed in favor of Brevo HTTP API to bypass Render SMTP blocking.

exports.createNotification = async ({ user_id, type, title, message, related_id }) => {
  try {
    if (!user_id) return;
    const notif = await Notification.create({ user_id, type, title, message, related_id });
    console.log(`[Notification] Created: "${title}" for user ${user_id}`);
    return notif;
  } catch (err) { console.error('[Notification] Error creating notification:', err.message); }
};

exports.sendEmail = async ({ userId, subject, text }) => {
  try {
    const u = await User.findById(userId);
    if (!u || !u.email) return;

    const senderEmail = process.env.EMAIL_USER || 'ai@petrovalves.co.in';

    // 1. Try SMTP first
    try {
      const port = parseInt(process.env.SMTP_PORT || 465, 10);
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'mail.petrovalves.co.in',
        port: port,
        secure: port === 465,
        auth: {
          user: process.env.SMTP_USER || 'ai@petrovalves.co.in',
          pass: process.env.SMTP_PASS || 'Ai@@27042026'
        },
        connectionTimeout: 5000,
        greetingTimeout: 5000
      });

      await transporter.sendMail({
        from: `"Petro Valve Workflow System" <${senderEmail}>`,
        to: u.email,
        subject: subject,
        text: text
      });

      console.log(`[Email] Notification email successfully sent via SMTP to ${u.email}`);
      return;
    } catch (smtpErr) {
      console.error(`[Email] SMTP send failed: ${smtpErr.message}. Trying fallback to Brevo HTTP API...`);
      if (process.env.BREVO_API_KEY) {
        try {
          const { sendEmailViaBrevoApi } = require('./emailService');
          await sendEmailViaBrevoApi({
            to: u.email,
            subject: subject,
            text: text
          });
          console.log(`[Email] Notification email successfully sent via Brevo HTTP API to ${u.email}`);
        } catch (fallbackErr) {
          console.error(`[Email] Brevo HTTP API fallback also failed: ${fallbackErr.message}`);
        }
      } else {
        console.error(`[Email] No BREVO_API_KEY set. Cannot try fallback.`);
      }
    }
  } catch (err) {
    console.error('[Email] Error sending email:', err.message);
  }
};

/**
 * Notify all users that have a matching role code.
 * Handles both:
 *   - Direct string match (e.g. user.role === 'SUPER_ADMIN')
 *   - Role code lookup (e.g. user.role stores a Role name/code like 'SA', 'DIR')
 */
exports.notifyRoles = async ({ roles, type, title, message, related_id }) => {
  try {
    // Normalize roles to uppercase for comparison
    const normalizedRoles = roles.map(r => r.toUpperCase());

    // Strategy 1: Direct match on user.role field
    const users = await User.find({ is_active: true });

    // Strategy 2: Also look up Role documents to find matching codes
    const matchingRoles = await Role.find({
      $or: [
        { code: { $in: normalizedRoles } },
        { name: { $regex: new RegExp(normalizedRoles.join('|'), 'i') } }
      ]
    });
    const matchingRoleCodes = matchingRoles.map(r => r.code);
    const matchingRoleNames = matchingRoles.map(r => r.name);

    let notifiedCount = 0;
    for (const u of users) {
      const userRole = (u.role || '').toUpperCase();
      const shouldNotify = normalizedRoles.includes(userRole) ||
        matchingRoleCodes.includes(u.role) ||
        matchingRoleNames.includes(u.role);

      if (shouldNotify) {
        await exports.createNotification({ user_id: u._id, type, title, message, related_id });
        notifiedCount++;
      }
    }

    if (notifiedCount > 0) {
      console.log(`[Notification] notifyRoles: Notified ${notifiedCount} user(s) for roles [${roles.join(', ')}]`);
    }
  } catch (err) { console.error('[Notification] notifyRoles error:', err.message); }
};

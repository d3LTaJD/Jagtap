const Notification = require('../models/Notification');

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

    if (!process.env.BREVO_API_KEY) {
      console.log(`\n========== [Email Mock] ==========`);
      console.log(`To: ${u.email}\nSubject: ${subject}\nBody: \n${text}`);
      console.log(`==================================\n`);
      return; 
    }

    const payload = {
      sender: { name: "Petro Valve Workflow System", email: process.env.EMAIL_USER || "datawhiz.ai@gmail.com" },
      to: [{ email: u.email }],
      subject: subject,
      textContent: text
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.text();
      console.error('[Email] Brevo API Error:', errData);
    } else {
      console.log(`[Email] Successfully sent via Brevo to ${u.email}`);
    }
  } catch (err) {
    console.error('[Email] Error sending email via Brevo:', err.message);
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

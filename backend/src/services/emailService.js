const nodemailer = require('nodemailer');

// For production, use actual SMTP variables from process.env
// For development, we fallback to Ethereal Email (a fake SMTP service for testing)
const createTransport = async () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  } else {
    // Generate test SMTP service account from ethereal.email
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
  }
};

/**
 * Send an email
 * @param {Object} options Options object containing {to, subject, text, html, attachments}
 */
exports.sendEmail = async (options) => {
  try {
    const transporter = await createTransport();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"Petro Valve Workflow System" <noreply@petrovalve.com>',
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments || [] // Nodemailer format: [{ filename: 'test.pdf', content: buffer }]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
    
    // Preview only available when sending through an Ethereal account
    if (!process.env.SMTP_HOST) {
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email sending failed:', error);
    throw new Error('Email sending failed: ' + error.message);
  }
};

const nodemailer = require('nodemailer');
const https = require('https');

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
 * Send an email via Brevo HTTP API (bypasses Render SMTP blocking)
 * @param {Object} options Options object containing {to, subject, text, html, attachments}
 */
const sendEmailViaBrevoApi = async (options) => {
  return new Promise((resolve, reject) => {
    if (!process.env.BREVO_API_KEY) {
      return reject(new Error('BREVO_API_KEY environment variable is not set'));
    }

    const senderEmail = process.env.EMAIL_USER || 'ai@petrovalves.co.in';
    const senderName = 'Petro Valve System';

    // Format attachments for Brevo: base64 encoded content
    const brevoAttachments = (options.attachments || []).map(att => {
      let base64Content = '';
      if (Buffer.isBuffer(att.content)) {
        base64Content = att.content.toString('base64');
      } else if (typeof att.content === 'string') {
        base64Content = Buffer.from(att.content).toString('base64');
      }
      return {
        name: att.filename,
        content: base64Content
      };
    });

    const payload = {
      sender: {
        name: senderName,
        email: senderEmail
      },
      to: [
        {
          email: options.to
        }
      ],
      subject: options.subject,
      textContent: options.text || options.html?.replace(/<[^>]+>/g, '') || '',
      htmlContent: options.html || options.text || ''
    };

    if (brevoAttachments.length > 0) {
      payload.attachment = brevoAttachments;
    }

    if (options.headers) {
      payload.headers = options.headers;
    }

    const data = JSON.stringify(payload);

    const reqOptions = {
      hostname: 'api.brevo.com',
      port: 443,
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(data)
      }
    };

    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve({ success: true, message: 'Email sent successfully' });
          }
        } else {
          reject(new Error(`Brevo API returned status ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(data);
    req.end();
  });
};

/**
 * Send an email with SMTP first, falling back to Brevo HTTP API on failure
 * @param {Object} options Options object containing {to, subject, text, html, attachments}
 */
exports.sendEmail = async (options) => {
  try {
    console.log(`[Email Service] Attempting to send email to ${options.to} via SMTP...`);
    const transporter = await createTransport();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"Petro Valve System" <ai@petrovalves.co.in>',
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments || []
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[Email Service] Message sent successfully via SMTP: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.warn(`[Email Service] SMTP send failed (${error.message}). Falling back to Brevo HTTP API...`);
    if (process.env.BREVO_API_KEY) {
      try {
        const result = await sendEmailViaBrevoApi(options);
        console.log('[Email Service] Message sent successfully via Brevo HTTP API:', result);
        return { success: true, fallback: true };
      } catch (fallbackError) {
        console.error('[Email Service] Fallback to Brevo HTTP API also failed:', fallbackError.message);
        throw fallbackError;
      }
    } else {
      console.error('[Email Service] SMTP failed and no BREVO_API_KEY configured for fallback.');
      throw error;
    }
  }
};

exports.sendEmailViaBrevoApi = sendEmailViaBrevoApi;

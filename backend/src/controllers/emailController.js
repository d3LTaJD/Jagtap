const { sendEmail } = require('../services/emailService');
const FileMetadata = require('../models/FileMetadata');
const { getFileBufferFromS3 } = require('../services/s3Service');

exports.sendCustomEmail = async (req, res, next) => {
  try {
    const { to, subject, bodyText, attachmentIds } = req.body;

    if (!to || !subject) {
      return res.status(400).json({ status: 'error', message: 'Missing recipient or subject' });
    }

    const emailOptions = {
      to,
      subject,
      text: bodyText || '',
      html: `<div style="font-family: sans-serif; line-height: 1.5; color: #333;">
              <p>${(bodyText || '').replace(/\\n/g, '<br>')}</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
              <p style="font-size: 11px; color: #888;">This is an automated message dispatched from the Petro Valve Workflow Platform.</p>
             </div>`,
      attachments: []
    };

    // Attach files if any ids provided
    if (attachmentIds && Array.isArray(attachmentIds) && attachmentIds.length > 0) {
      const files = await FileMetadata.find({ _id: { $in: attachmentIds } });
      
      for (const file of files) {
        try {
          // Fetch the actual file body from S3
          const buffer = await getFileBufferFromS3(file.s3Key);
          
          if (buffer) {
            emailOptions.attachments.push({
              filename: file.originalName,
              content: buffer,
              contentType: file.mimeType
            });
          }
        } catch (fileErr) {
          console.error(`Failed to attach file ${file.fileName}:`, fileErr);
          // Optional: we can choose to abort email or just skip the attachment. We skip it here.
        }
      }
    }

    const result = await sendEmail(emailOptions);

    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
};

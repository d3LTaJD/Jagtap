const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const path = require('path');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1', // Default or from env
  credentials: {
    // If not set, SDK will look for standard local AWS credentials profile fallback
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'PENDING_KEY',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'PENDING_SECRET',
  }
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'petro-valve-erp-files';

exports.uploadFileToS3 = async (fileBuffer, originalName, mimeType) => {
  // Generate a unique S3 key protecting against overwrites
  const uniquePrefix = crypto.randomBytes(8).toString('hex');
  const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const s3Key = `uploads/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${uniquePrefix}-${safeName}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: fileBuffer,
    ContentType: mimeType,
    // ServerSideEncryption: 'AES256' // Best practice for enterprise files
  });

  // Since we might be running without real keys yet, wrap to avoid crashing app
  try {
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_ACCESS_KEY_ID !== 'PENDING_KEY') {
       await s3Client.send(command);
    } else {
       console.warn(`[S3 MOCK] Uploading file ignored. Wait for AWS keys in .env. Key: ${s3Key}`);
    }
  } catch (err) {
    console.error('S3 Upload Error:', err);
    throw new Error('Failed to upload file to S3');
  }

  return s3Key;
};

exports.getSignedDownloadUrl = async (s3Key) => {
  try {
     if (!process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID === 'PENDING_KEY') {
       return `http://mock-s3-url.com/${s3Key}`; // Mock fallback for testing UI
     }

     const command = new GetObjectCommand({
       Bucket: BUCKET_NAME,
       Key: s3Key,
     });
     
     // Generate a signed URL valid for 1 hour (3600 seconds)
     const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
     return url;
  } catch(err) {
    console.error('S3 Signed URL Error:', err);
    throw new Error('Failed to generate secure URL');
  }
};

exports.getFileBufferFromS3 = async (s3Key) => {
  try {
    if (!process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID === 'PENDING_KEY') {
      return Buffer.from('MOCK_PDF_CONTENT', 'utf-8'); // Mock fallback
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });

    const response = await s3Client.send(command);
    
    // Convert Readable stream to Buffer
    const streamToBuffer = (stream) =>
      new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks)));
      });

    return await streamToBuffer(response.Body);
  } catch (err) {
    console.error('S3 Get stream error:', err);
    throw new Error('Failed to retrieve file from S3');
  }
};

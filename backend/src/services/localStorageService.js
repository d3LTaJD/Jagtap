const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Ensure uploads folder exists in backend root
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Uploads a file to local storage.
 * @param {Buffer} fileBuffer 
 * @param {string} originalName 
 * @param {string} mimeType 
 * @returns {Promise<string>} The filename on disk (fileKey)
 */
exports.uploadFile = async (fileBuffer, originalName, mimeType) => {
  const uniquePrefix = crypto.randomBytes(8).toString('hex');
  const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileName = `${uniquePrefix}-${safeName}`;
  const filePath = path.join(UPLOADS_DIR, fileName);

  try {
    fs.writeFileSync(filePath, fileBuffer);
    console.log(`[LOCAL STORAGE] Successfully wrote file to disk: ${filePath}`);
  } catch (err) {
    console.error('Local file write error:', err);
    throw new Error('Failed to write file locally');
  }

  // We return the file name as the fileKey/reference
  return fileName;
};

/**
 * Generates a local download link.
 * @param {string} fileKey 
 * @returns {Promise<string>}
 */
exports.getDownloadUrl = async (fileKey) => {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    return `${backendUrl}/api/files/download-local/${fileKey}`;
  } catch (err) {
    console.error('Local file download URL error:', err);
    throw new Error('Failed to generate local URL');
  }
};

/**
 * Reads a file buffer from local disk.
 * @param {string} fileKey 
 * @returns {Promise<Buffer>}
 */
exports.getFileBuffer = async (fileKey) => {
  try {
    const filePath = path.join(UPLOADS_DIR, fileKey);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    return fs.readFileSync(filePath);
  } catch (err) {
    console.error('Local file read error:', err);
    throw new Error('Failed to retrieve file from local storage');
  }
};

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const FileMetadata = require('../models/FileMetadata');
const { uploadFile, getDownloadUrl } = require('../services/localStorageService');

// Use memory storage to process file buffer before saving
const storage = multer.memoryStorage();
exports.upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// POST /api/files/upload
exports.uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'fail', message: 'No file provided' });
    }

    const { module = 'Temp', entityId } = req.body;
    
    // 1. Save file to disk
    const fileKey = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);

    // 2. Save metadata to MongoDB
    const fileMeta = await FileMetadata.create({
      fileName: req.file.originalname,
      originalName: req.file.originalname,
      fileKey,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.user._id,
      module,
      entityId: (entityId && require('mongoose').Types.ObjectId.isValid(entityId)) ? entityId : null
    });

    // 3. If this is an Enquiry attachment, also create an Attachment record and
    //    queue it for text extraction + AI field filling (same pipeline as email attachments)
    if (module === 'Enquiry' && entityId) {
      try {
        const Attachment = require('../models/Attachment');
        const Enquiry = require('../models/Enquiry');
        const enquiry = await Enquiry.findById(entityId);
        
        if (enquiry) {
          const attachment = await Attachment.create({
            customerId: enquiry.customer,
            threadId: enquiry.threadId || '',
            originalFileName: req.file.originalname,
            fileType: req.file.mimetype,
            fileSize: req.file.size,
            storagePath: fileKey,
            extractedText: '',
            extractionStatus: 'PENDING',
            processingStatus: 'Pending',
            attachmentOwnerType: 'User',
            uploadedBy: req.user._id,
            linkedEnquiries: [enquiry._id]
          });

          // Link attachment to enquiry
          if (!enquiry.attachmentsList) enquiry.attachmentsList = [];
          enquiry.attachmentsList.push(attachment._id);
          await enquiry.save();

          // Queue for text extraction → AI field extraction
          const { attachmentReprocessingQueue } = require('../services/queueHandlers');
          await attachmentReprocessingQueue.add({ attachmentId: attachment._id });
          console.log(`[Upload] Queued manual attachment ${req.file.originalname} for extraction on enquiry ${enquiry.enquiryId}`);
        }
      } catch (extractionErr) {
        // Don't fail the upload if extraction queueing fails
        console.error('[Upload] Failed to queue attachment for extraction:', extractionErr.message);
      }
    }

    res.status(201).json({ 
      status: 'success', 
      data: { file: fileMeta } 
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/files/:id/download-url
// Returns local server download link
exports.getSecureDownloadUrl = async (req, res, next) => {
  try {
    const fileMeta = await FileMetadata.findById(req.params.id);
    if (!fileMeta) return res.status(404).json({ status: 'fail', message: 'File not found' });

    const downloadUrl = await getDownloadUrl(fileMeta.fileKey);
    
    res.status(200).json({ 
      status: 'success', 
      data: { 
        url: downloadUrl, 
        fileName: fileMeta.fileName,
        mimeType: fileMeta.mimeType
      } 
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/files/download-local/:key
// Authenticated endpoint with path-traversal protection & access control
exports.downloadLocalFile = async (req, res, next) => {
  try {
    let rawKey = req.params.key;

    if (!rawKey || typeof rawKey !== 'string') {
      return res.status(400).json({ status: 'fail', message: 'Invalid file key' });
    }

    // Strip leading 'local/' if present
    rawKey = rawKey.replace(/^local[/\\]+/i, '');

    // 1. Path-traversal defense: sanitize and isolate key
    const sanitizedKey = path.basename(rawKey).replace(/(\.\.[\/\\])/g, '').replace(/[\0\x00-\x1f]/g, '');
    if (!sanitizedKey || rawKey.includes('..')) {
      return res.status(403).json({ status: 'fail', message: 'Invalid file key or path traversal detected' });
    }

    const uploadsBaseDir = path.resolve(__dirname, '../../uploads');
    let targetFilePath = path.resolve(uploadsBaseDir, sanitizedKey);

    // If direct file path doesn't exist, search database records
    const Attachment = require('../models/Attachment');
    if (!fs.existsSync(targetFilePath)) {
      const attachment = await Attachment.findOne({
        $or: [
          { storagePath: sanitizedKey },
          { storagePath: `local/${sanitizedKey}` },
          { storagePath: rawKey },
          { storagePath: `local/${rawKey}` },
          { originalFileName: sanitizedKey }
        ]
      });

      if (attachment) {
        const cleanStorageKey = attachment.storagePath.replace(/^local[/\\]+/i, '');
        const altPath = path.resolve(uploadsBaseDir, cleanStorageKey);
        if (fs.existsSync(altPath)) {
          targetFilePath = altPath;
        }
      }
    }

    // If still not found, try fuzzy match in uploads folder
    if (!fs.existsSync(targetFilePath)) {
      const allFiles = fs.readdirSync(uploadsBaseDir);
      const cleanSearch = sanitizedKey.replace(/[-_]/g, '').toLowerCase();
      const matched = allFiles.find(f => {
        const cleanF = f.replace(/[-_]/g, '').toLowerCase();
        return cleanF === cleanSearch || cleanF.includes(cleanSearch) || cleanSearch.includes(cleanF);
      });
      if (matched) {
        targetFilePath = path.resolve(uploadsBaseDir, matched);
      }
    }

    if (!fs.existsSync(targetFilePath)) {
      return res.status(404).json({ status: 'fail', message: 'File not found on server' });
    }

    // Determine original filename
    const [fileMeta, attachment] = await Promise.all([
      FileMetadata.findOne({ fileKey: sanitizedKey }),
      Attachment.findOne({ $or: [{ storagePath: sanitizedKey }, { storagePath: `local/${sanitizedKey}` }] })
    ]);

    const originalFileName = fileMeta?.originalName || fileMeta?.fileName || attachment?.originalFileName || path.basename(targetFilePath);

    res.download(targetFilePath, originalFileName);
  } catch (err) {
    next(err);
  }
};

// GET /api/files
// Fetches a paginated list of all uploaded files, sorted by newest
exports.getAllFiles = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 30;
    const { module, search } = req.query;

    let query = {};
    if (module) query.module = module;
    if (search) query.originalName = { $regex: search, $options: 'i' };

    const total = await FileMetadata.countDocuments(query);
    const files = await FileMetadata.find(query)
      .populate('uploadedBy', 'fullName')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      status: 'success',
      data: {
        total,
        page,
        pages: Math.ceil(total / limit),
        files
      }
    });
  } catch (err) {
    next(err);
  }
};

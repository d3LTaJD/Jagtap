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
      entityId: entityId || null
    });

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
// Public endpoint for downloading files stored locally on server disk
exports.downloadLocalFile = (req, res, next) => {
  try {
    const key = req.params.key;
    const filePath = path.join(__dirname, '../../uploads', key);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ status: 'fail', message: 'File not found' });
    }
    
    res.download(filePath);
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

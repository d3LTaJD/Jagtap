const express = require('express');
const uploadController = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public download route for window.open downloads
router.get('/download-local/:key', uploadController.downloadLocalFile);

router.use(protect); // Secure all file operations

router.get('/', uploadController.getAllFiles);
// POST /api/files/upload (multipart/form-data)
router.post('/upload', uploadController.upload.single('file'), uploadController.uploadFile);

// GET /api/files/:id/download-url
router.get('/:id/download-url', uploadController.getSecureDownloadUrl);

module.exports = router;

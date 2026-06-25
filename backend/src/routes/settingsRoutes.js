const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { protect, requirePermission } = require('../middleware/auth');

// SOW: Settings / Notification templates — SA + DIR
router.get('/', protect, requirePermission('Admin', 'settingsRead'), getSettings);
router.patch('/', protect, requirePermission('Admin', 'settingsWrite'), updateSettings);

module.exports = router;

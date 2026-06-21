const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { protect, requirePermission } = require('../middleware/auth');

// Only SA (Super Admin) can read/update system settings
router.get('/', protect, getSettings);
router.patch('/', protect, requirePermission('Admin', 'edit'), updateSettings);

module.exports = router;

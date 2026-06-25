const express = require('express');
const { protect, requirePermission, authorize } = require('../middleware/auth');
const {
  getFields, getField, createField, updateField,
  reorderFields, deleteField, restoreField
} = require('../controllers/fieldController');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Read — any authenticated user can fetch field definitions to render forms
router.get('/', getFields);
router.get('/:id', getField);

// Write — only SA (SOW: Dynamic field builder = SA only)
router.post('/', requirePermission('Admin', 'fieldBuilder'), createField);
router.patch('/reorder', requirePermission('Admin', 'fieldBuilder'), reorderFields);
router.patch('/:id', requirePermission('Admin', 'fieldBuilder'), updateField);
router.patch('/:id/restore', requirePermission('Admin', 'fieldBuilder'), restoreField);
router.delete('/:id', requirePermission('Admin', 'fieldBuilder'), deleteField);

module.exports = router;

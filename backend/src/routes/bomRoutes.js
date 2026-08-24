const express = require('express');
const router = express.Router();
const bomController = require('../controllers/bomController');
const { protect, requirePermission } = require('../middleware/auth');

// List & view BOMs
router.get('/', protect, requirePermission('BOM', 'view'), bomController.getBoms);
router.get('/:id', protect, requirePermission('BOM', 'view'), bomController.getBom);

// Auto-generate AI BOM from Work Order
router.post('/generate/:workOrderId', protect, requirePermission('BOM', 'create'), bomController.generateBomForWorkOrder);

// Adjust BOM components
router.put('/:id', protect, requirePermission('BOM', 'edit'), bomController.updateBom);

// Confirm BOM & Generate PRs
router.post('/:id/confirm', protect, requirePermission('BOM', 'confirm'), bomController.confirmBom);

module.exports = router;

const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');
const { protect, requirePermission } = require('../middleware/auth');

// Requisitions (PRs)
router.get('/requisitions', protect, requirePermission('Purchase', 'view'), purchaseController.getRequisitions);

// Purchase Orders (POs)
router.get('/orders', protect, requirePermission('Purchase', 'view'), purchaseController.getPurchaseOrders);
router.get('/orders/:id', protect, requirePermission('Purchase', 'view'), purchaseController.getPurchaseOrder);
router.post('/orders', protect, requirePermission('Purchase', 'createPO'), purchaseController.createPurchaseOrder);

// CPD Risk Matrix
router.get('/cpd-risk-matrix', protect, requirePermission('Purchase', 'view'), purchaseController.getCpdRiskMatrix);

module.exports = router;

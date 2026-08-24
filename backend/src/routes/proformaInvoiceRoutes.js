const express = require('express');
const router = express.Router();
const proformaInvoiceController = require('../controllers/proformaInvoiceController');
const { protect, requirePermission } = require('../middleware/auth');

// List & view PIs
router.get('/', protect, requirePermission('Purchase', 'view'), proformaInvoiceController.getProformaInvoices);
router.get('/:id', protect, requirePermission('Purchase', 'view'), proformaInvoiceController.getProformaInvoice);

// Reconcile PI against PO
router.post('/reconcile', protect, requirePermission('Purchase', 'reconcilePI'), proformaInvoiceController.reconcilePi);

// Review & Override deviations
router.post('/:id/review', protect, requirePermission('Purchase', 'overridePI'), proformaInvoiceController.reviewDeviations);

module.exports = router;

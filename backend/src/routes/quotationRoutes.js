const express = require('express');
const { protect, requirePermission } = require('../middleware/auth');
const quotationController = require('../controllers/quotationController');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(requirePermission('Quotation', 'view'), quotationController.getQuotations)
  .post(requirePermission('Quotation', 'create'), quotationController.createQuotation);

router.route('/:id')
  .get(requirePermission('Quotation', 'view'), quotationController.getQuotation)
  .delete(requirePermission('Quotation', 'delete'), quotationController.deleteQuotation);

router.patch('/:id/status', requirePermission('Quotation', 'edit'), quotationController.updateQuotationStatus);
router.post('/:id/sync-enquiry', requirePermission('Quotation', 'edit'), quotationController.syncEnquiryItems);
router.post('/:id/generate-pdf', requirePermission('Quotation', 'edit'), quotationController.generatePdf);

router.route('/:id/pdf')
  .get(requirePermission('Quotation', 'view'), quotationController.downloadPDF);

module.exports = router;

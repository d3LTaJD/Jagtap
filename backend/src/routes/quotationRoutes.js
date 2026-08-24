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

const multer = require('multer');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

router.patch('/:id/status', requirePermission('Quotation', 'edit'), quotationController.updateQuotationStatus);
router.post('/:id/sync-enquiry', requirePermission('Quotation', 'edit'), quotationController.syncEnquiryItems);
router.post('/:id/generate-pdf', requirePermission('Quotation', 'edit'), quotationController.generatePdf);
router.get('/:id/export-excel', requirePermission('Quotation', 'view'), quotationController.exportPricingExcel);
router.post('/:id/validate-excel', requirePermission('Quotation', 'edit'), upload.single('file'), quotationController.validatePricingExcel);
router.post('/:id/import-excel', requirePermission('Quotation', 'edit'), upload.single('file'), quotationController.importPricingExcel);

// Pricing Intelligence Routes
router.get('/:id/pricing-suggestions', requirePermission('Quotation', 'view'), quotationController.getPricingSuggestions);
router.post('/pricing-suggestions', requirePermission('Quotation', 'view'), quotationController.getCustomPricingSuggestions);

// Revision Tracking & Auto-Diff Routes
router.get('/:id/revisions', requirePermission('Quotation', 'view'), quotationController.getRevisionsHistory);
router.get('/:id/diff-since-last-sent', requirePermission('Quotation', 'view'), quotationController.getLiveDiffSinceLastSent);
router.post('/:id/send-email', requirePermission('Quotation', 'edit'), quotationController.sendQuotationEmailAndRecordRevision);
// 7-Step Workflow Lifecycle Routes
router.post('/:id/route-to-qc', requirePermission('Quotation', 'routeToQc'), quotationController.routeToQc);
router.post('/:id/submit-tech-review', requirePermission('Quotation', 'submitTechnicalReview'), quotationController.submitTechnicalReview);
router.post('/:id/checker-review', requirePermission('Quotation', 'checkerReview'), quotationController.checkerReview);
router.post('/:id/director-approve', requirePermission('Quotation', 'approve'), quotationController.directorApprove);
router.post('/:id/unlock-tech', requirePermission('Quotation', 'unlockTechnical'), quotationController.unlockTechnical);

router.route('/:id/pdf')
  .get(requirePermission('Quotation', 'view'), quotationController.downloadPDF);

module.exports = router;

const express = require('express');
const { protect, requirePermission } = require('../middleware/auth');
const { generateQapFromQuotation, getQaps, getQap, updateQapStatus, downloadQapPdf } = require('../controllers/qapController');

const router = express.Router();

router.use(protect);

// SOW: QAP view — SA, DIR, TA, SALES(R), DE(R), QCE, QCS, MGR(R) — ACC blocked
router.route('/')
  .get(requirePermission('QAP', 'view'), getQaps)
  .post(requirePermission('QAP', 'generateDraft'), generateQapFromQuotation);

router.route('/:id')
  .get(requirePermission('QAP', 'view'), getQap)
  .patch(requirePermission('QAP', 'editActivities'), updateQapStatus);

router.route('/:id/pdf')
  .get(requirePermission('QAP', 'view'), downloadQapPdf);

// Edit/status uses controller-level enforcement for granular actions
router.route('/:id/status')
  .patch(requirePermission('QAP', 'editActivities'), updateQapStatus);

module.exports = router;

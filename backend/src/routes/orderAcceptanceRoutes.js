const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createOrderAcceptanceFromPo,
  getOrderAcceptances,
  getOrderAcceptance,
  downloadOrderAcceptancePdf,
  downloadCustomerPiPdf,
  recordAdvancePayment
} = require('../controllers/orderAcceptanceController');

router.use(protect);

router.post('/from-po', createOrderAcceptanceFromPo);
router.get('/', getOrderAcceptances);
router.get('/proforma-invoice/:id/pdf', downloadCustomerPiPdf);
router.get('/:id/pdf', downloadOrderAcceptancePdf);
router.get('/:id', getOrderAcceptance);
router.post('/record-advance', recordAdvancePayment);

module.exports = router;

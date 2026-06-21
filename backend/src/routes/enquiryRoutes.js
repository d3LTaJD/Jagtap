const express = require('express');
const { protect, requirePermission } = require('../middleware/auth');
const { 
  createEnquiry, 
  getEnquiries, 
  getEnquiry, 
  updateEnquiry, 
  deleteEnquiry,
  verifyAndApproveEnquiry,
  getEnquiryThreadEmails,
  suggestEnquiryFields
} = require('../controllers/enquiryController');
const followUpRouter = require('./followUpRoutes');

const router = express.Router();

// Require login to access any enquiry routes
router.use(protect);

router.post('/suggest-fields', requirePermission('Enquiry', 'create'), suggestEnquiryFields);

// Mount nested routers
router.use('/:enquiryId/followups', followUpRouter);

router.route('/')
  .get(requirePermission('Enquiry', 'view'), getEnquiries)
  .post(requirePermission('Enquiry', 'create'), createEnquiry);

router.patch('/:id/verify-approve', requirePermission('Enquiry', 'edit'), verifyAndApproveEnquiry);
router.get('/:id/thread-emails', requirePermission('Enquiry', 'view'), getEnquiryThreadEmails);

router.route('/:id')
  .get(requirePermission('Enquiry', 'view'), getEnquiry)
  .patch(requirePermission('Enquiry', 'edit'), updateEnquiry)
  .delete(requirePermission('Enquiry', 'delete'), deleteEnquiry);

module.exports = router;

const express = require('express');
const followUpController = require('../controllers/followUpController');
const { protect, requirePermission } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(requirePermission('Enquiry', 'view'), followUpController.getFollowUps)
  .post(requirePermission('Enquiry', 'edit'), followUpController.addFollowUp);

router.route('/:id')
  .patch(requirePermission('Enquiry', 'edit'), followUpController.updateFollowUp)
  .delete(requirePermission('Enquiry', 'edit'), followUpController.deleteFollowUp);

module.exports = router;

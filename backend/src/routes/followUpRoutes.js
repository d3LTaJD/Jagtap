const express = require('express');
const followUpController = require('../controllers/followUpController');
const { protect, requirePermission } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

router.use(protect);

// SOW: FollowUp module permissions (not Enquiry!)
router.route('/')
  .get(requirePermission('FollowUp', 'view'), followUpController.getFollowUps)
  .post(requirePermission('FollowUp', 'create'), followUpController.addFollowUp);

router.route('/:id')
  .patch(requirePermission('FollowUp', 'edit'), followUpController.updateFollowUp)
  .delete(requirePermission('FollowUp', 'edit'), followUpController.deleteFollowUp);

module.exports = router;

const express = require('express');
const roleController = require('../controllers/roleController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Only SUPER_ADMIN and DIRECTOR can manage roles
router.use(protect);
router.use(authorize('SUPER_ADMIN', 'DIRECTOR', 'SA', 'DIR'));

router.route('/')
  .get(roleController.getRoles)
  .post(roleController.createRole);

router.route('/:id')
  .patch(roleController.updateRole)
  .delete(roleController.deleteRole);

module.exports = router;

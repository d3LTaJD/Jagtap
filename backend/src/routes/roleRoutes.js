const express = require('express');
const roleController = require('../controllers/roleController');
const { protect, requirePermission } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// SOW: Role management — SA write, SA+DIR read
router.get('/', requirePermission('Admin', 'roleManageRead'), roleController.getRoles);
router.post('/', requirePermission('Admin', 'roleManageWrite'), roleController.createRole);

router.route('/:id')
  .patch(requirePermission('Admin', 'roleManageWrite'), roleController.updateRole)
  .delete(requirePermission('Admin', 'roleManageWrite'), roleController.deleteRole);

module.exports = router;

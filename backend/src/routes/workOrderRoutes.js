const express = require('express');
const { protect, requirePermission } = require('../middleware/auth');
const workOrderController = require('../controllers/workOrderController');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(requirePermission('WorkOrder', 'view'), workOrderController.getWorkOrders)
  .post(requirePermission('WorkOrder', 'create'), workOrderController.createWorkOrder);

router.route('/:id')
  .get(requirePermission('WorkOrder', 'view'), workOrderController.getWorkOrder);

// Release route (Authoritative Hard Gate enforced in controller/service)
router.post('/:id/release', requirePermission('WorkOrder', 'release'), workOrderController.releaseWorkOrder);

module.exports = router;

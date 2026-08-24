const express = require('express');
const vendorController = require('../controllers/vendorController');
const { protect, requirePermission } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(requirePermission('Vendors', 'view'), vendorController.getVendors)
  .post(requirePermission('Vendors', 'create'), vendorController.createVendor);

router.route('/:id')
  .get(requirePermission('Vendors', 'view'), vendorController.getVendor)
  .put(requirePermission('Vendors', 'edit'), vendorController.updateVendor)
  .delete(requirePermission('Vendors', 'delete'), vendorController.deleteVendor);

module.exports = router;

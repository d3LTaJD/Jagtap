const express = require('express');
const router = express.Router();
const c = require('../controllers/customerController');
const { protect, requirePermission } = require('../middleware/auth');

router.use(protect);

// SOW: Customers — view: all, create/edit/delete: SA, DIR, TA
router.get('/', requirePermission('Customers', 'view'), c.getCustomers);
router.get('/:id', requirePermission('Customers', 'view'), c.getCustomer);
router.post('/', requirePermission('Customers', 'create'), c.createCustomer);
router.patch('/:id', requirePermission('Customers', 'edit'), c.updateCustomer);
router.delete('/:id', requirePermission('Customers', 'delete'), c.deleteCustomer);

module.exports = router;

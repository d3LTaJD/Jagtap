const express = require('express');
const { 
  createUser, 
  getUsers, 
  toggleUserStatus, 
  editUser, 
  resetUserPassword,
  getQueueJobs,
  retryQueueJob,
  getQueueHealth
} = require('../controllers/adminController');
const { protect, requirePermission } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// SOW: User management — SA write, DIR read-only
// Read operations — SA + DIR
router.get('/users', requirePermission('Admin', 'userManageRead'), getUsers);
router.get('/users/:id/logs', requirePermission('Admin', 'userManageRead'), require('../controllers/adminController').getUserActivityLogs);

// Write operations — SA only
router.post('/users', requirePermission('Admin', 'userManageWrite'), createUser);
router.patch('/users/:id', requirePermission('Admin', 'userManageWrite'), toggleUserStatus);
router.put('/users/:id', requirePermission('Admin', 'userManageWrite'), editUser);
router.delete('/users/:id', requirePermission('Admin', 'userManageWrite'), require('../controllers/adminController').deleteUser);
router.post('/users/:id/reset-password', requirePermission('Admin', 'userManageWrite'), resetUserPassword);

// SOW: Audit log view — SA + DIR
router.route('/logs')
  .get(requirePermission('Admin', 'auditLogView'), require('../controllers/adminController').getAllActivityLogs)
  .delete(requirePermission('Admin', 'userManageWrite'), require('../controllers/adminController').deleteActivityLogs);
router.route('/system-logs')
  .get(requirePermission('Admin', 'auditLogView'), require('../controllers/adminController').getSystemAuditLogs)
  .delete(requirePermission('Admin', 'userManageWrite'), require('../controllers/adminController').clearSystemAuditLogs);

// Queue management — SA only
router.route('/queue-jobs')
  .get(requirePermission('Admin', 'userManageWrite'), getQueueJobs)
  .delete(requirePermission('Admin', 'userManageWrite'), require('../controllers/adminController').clearAllFailedQueueJobs);

router.route('/queue-jobs/:id')
  .post(requirePermission('Admin', 'userManageWrite'), retryQueueJob)
  .delete(requirePermission('Admin', 'userManageWrite'), require('../controllers/adminController').deleteQueueJob);

router.get('/queue-health', requirePermission('Admin', 'userManageWrite'), getQueueHealth);

module.exports = router;

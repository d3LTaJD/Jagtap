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
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(authorize('SUPER_ADMIN', 'DIRECTOR', 'SA', 'DIR'));

router.route('/users')
  .post(createUser)
  .get(getUsers);

router.route('/users/:id')
  .patch(toggleUserStatus)
  .put(editUser)
  .delete(require('../controllers/adminController').deleteUser);
router.post('/users/:id/reset-password', resetUserPassword);
router.get('/users/:id/logs', require('../controllers/adminController').getUserActivityLogs);
router.route('/logs')
  .get(require('../controllers/adminController').getAllActivityLogs)
  .delete(require('../controllers/adminController').deleteActivityLogs);
router.route('/system-logs')
  .get(require('../controllers/adminController').getSystemAuditLogs)
  .delete(require('../controllers/adminController').clearSystemAuditLogs);

router.route('/queue-jobs')
  .get(getQueueJobs)
  .delete(require('../controllers/adminController').clearAllFailedQueueJobs);

router.route('/queue-jobs/:id')
  .post(retryQueueJob)
  .delete(require('../controllers/adminController').deleteQueueJob);

router.get('/queue-health', getQueueHealth);

module.exports = router;

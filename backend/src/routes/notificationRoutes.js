const express = require('express');
const { protect, requirePermission } = require('../middleware/auth');
const { getNotifications, markAsRead, markAllAsRead, sendTestNotification } = require('../controllers/notificationController');

const router = express.Router();

router.use(protect);

router.get('/', getNotifications);
router.post('/test', requirePermission('Admin', 'notificationEdit'), sendTestNotification);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);

module.exports = router;

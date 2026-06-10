const Notification = require('../models/Notification');

// GET /api/notifications
exports.getNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 30;
    
    const query = { user_id: req.user._id };
    if (req.query.isRead !== undefined) {
      query.is_read = req.query.isRead === 'true';
    }

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ user_id: req.user._id, is_read: false });
    const notifications = await Notification.find(query)
      .sort('-created_at')
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({ 
      status: 'success', 
      data: { 
        notifications,
        total,
        unreadCount,
        page,
        pages: Math.ceil(total / limit)
      } 
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/notifications/:id/read
exports.markAsRead = async (req, res, next) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { is_read: true, isRead: true });
    res.status(200).json({ status: 'success' });
  } catch (err) { 
    next(err); 
  }
};

// PATCH /api/notifications/read-all
exports.markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user_id: req.user._id, is_read: false }, 
      { is_read: true, isRead: true }
    );
    res.status(200).json({ status: 'success' });
  } catch (err) { 
    next(err); 
  }
};

// POST /api/notifications/test
exports.sendTestNotification = async (req, res, next) => {
  try {
    const notif = await Notification.create({
      user_id: req.user._id,
      type: 'INFO',
      title: '🔔 Notification System Active',
      message: `This is a test notification sent at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}. Your notifications are working correctly!`
    });
    res.status(201).json({ status: 'success', data: { notification: notif } });
  } catch (err) { 
    next(err); 
  }
};

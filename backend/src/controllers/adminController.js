const User = require('../models/User');
const Token = require('../models/Token');
const otpUtils = require('../utils/otp');
const ActivityLog = require('../models/ActivityLog');
const { logActivity } = require('../utils/logger');
const { getNextSequenceValue } = require('../utils/counter');
const QueueJob = require('../models/QueueJob');
const SystemAuditLog = require('../models/SystemAuditLog');

// @desc    Create new user (Admin only)
// @route   POST /api/admin/users
exports.createUser = async (req, res, next) => {
  try {
    const { name, displayName, mobile_number, email, role, secondaryRole, department } = req.body;

    if (!email) {
      return res.status(400).json({ status: 'error', message: 'Email address is required to receive OTP/invites' });
    }

    const existingUser = await User.findOne({ mobile_number });
    if (existingUser) {
      return res.status(400).json({ status: 'error', message: 'User with this mobile number already exists' });
    }

    // Auto-generate USR-NNNN atomically
    const seq = await getNextSequenceValue('user');
    const userId = `USR-${String(seq).padStart(4, '0')}`;

    const user = await User.create({
      userId, name, displayName, mobile_number, email, role,
      secondaryRole: secondaryRole || null,
      department: department || ''
    });

    // Always generate OTP
    const rawToken = otpUtils.generateOTP();
    const hashedToken = await otpUtils.hashToken(rawToken);
    
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + (24 * 60)); // 24 hours

    await Token.create({
      user_id: user._id,
      token: hashedToken,
      type: 'OTP',
      expires_at: expiresAt
    });

    const { sendEmail } = require('../services/notificationService');
    const subject = 'Account Setup OTP - Workflow Automation';
    const text = `Hello ${name},\n\nYour account has been created.\nYour setup OTP is: ${rawToken}\nIt is valid for 24 hours.\nIf it expires, you will need to request a new one from the administrator.`;

    // Send email asynchronously without blocking the response
    sendEmail({
      userId: user._id,
      subject,
      text
    }).catch(err => console.error('[Admin] Background email error:', err.message));

    res.status(201).json({ 
      status: 'success', 
      message: 'User created successfully',
      data: { user: { id: user._id, name: user.name, role: user.role } } 
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all users (Admin only)
// @route   GET /api/admin/users
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password').sort('-created_at');
    res.status(200).json({ status: 'success', results: users.length, data: { users } });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle user active status
// @route   PATCH /api/admin/users/:id
exports.toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

    const originalUser = { ...user.toObject() };
    user.is_active = !user.is_active;
    await user.save({ validateBeforeSave: false });

    await logActivity({
      req,
      action: 'UPDATE',
      module: 'USER',
      resourceId: user._id,
      resourceName: user.name,
      previousState: originalUser,
      newState: user.toObject(),
      details: `Changed status of user ${user.name} to ${user.is_active ? 'Active' : 'Inactive'}`
    });

    res.status(200).json({ status: 'success', data: { user } });
  } catch (err) {
    next(err);
  }
};

// @desc    Edit existing user
// @route   PUT /api/admin/users/:id
exports.editUser = async (req, res, next) => {
  try {
    const { name, displayName, email, department, role, secondaryRole } = req.body;
    
    if (email === '') {
      return res.status(400).json({ status: 'error', message: 'Email address cannot be empty' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

    const originalUser = { ...user.toObject() };

    if (name) user.name = name;
    if (displayName !== undefined) user.displayName = displayName;
    if (email !== undefined) user.email = email;
    if (department !== undefined) user.department = department;
    if (role) user.role = role;
    if (secondaryRole !== undefined) user.secondaryRole = secondaryRole;

    await user.save({ validateBeforeSave: false });

    await logActivity({
      req,
      action: 'UPDATE',
      module: 'USER',
      resourceId: user._id,
      resourceName: user.name,
      previousState: originalUser,
      newState: user.toObject(),
      details: `Admin updated details for user ${user.name}`
    });

    res.status(200).json({ status: 'success', data: { user: { id: user._id, name: user.name, role: user.role, secondaryRole: user.secondaryRole, department: user.department } } });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ status: 'error', message: 'You cannot delete yourself' });
    }

    await User.findByIdAndDelete(req.params.id);

    await logActivity({
      req,
      action: 'DELETE',
      module: 'USER',
      resourceId: user._id,
      resourceName: user.name,
      previousState: user.toObject(),
      newState: null,
      details: `Admin completely deleted user: ${user.name}`
    });

    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    next(err);
  }
};

// @desc    Force generate a password reset link/OTP for a user
// @route   POST /api/admin/users/:id/reset-password
exports.resetUserPassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

    const rawToken = otpUtils.generateInviteToken();
    const hashedToken = await otpUtils.hashToken(rawToken);
    
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 60); // 1 hour validity

    await Token.create({
      user_id: user._id,
      token: hashedToken,
      type: 'INVITE',
      expires_at: expiresAt
    });

    console.log(`[ADMIN ACTION MOCK] Generated Admin Password Reset link for ${user.mobile_number}: ${rawToken}`);

    await logActivity({
      req,
      action: 'UPDATE',
      module: 'USER',
      resourceId: user._id,
      resourceName: user.name,
      details: `Admin generated a password reset link for user ${user.name}`
    });

    res.status(200).json({ 
      status: 'success', 
      message: 'Password reset link generated successfully',
      data: { token: rawToken } // returning token for UI dev display
    });
  } catch (err) {
    next(err);
  }
};

exports.getUserActivityLogs = async (req, res, next) => {
  try {
    const logs = await ActivityLog.find({ user_id: req.params.id })
      .populate('user_id', 'name role')
      .sort('-timestamp')
      .limit(50);
    res.status(200).json({ status: 'success', data: { logs } });
  } catch (err) {
    next(err);
  }
};

exports.getAllActivityLogs = async (req, res, next) => {
  try {
    const { module, user, action } = req.query;
    const filter = {};
    if (module) filter.module = module;
    if (user) filter.user_id = user;
    if (action) filter.action = action;

    const logs = await ActivityLog.find(filter)
      .populate('user_id', 'name role')
      .sort('-timestamp')
      .limit(200);
      
    res.status(200).json({ status: 'success', data: { logs } });
  } catch (err) {
    next(err);
  }
};

exports.getSystemAuditLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const { eventType, entityType } = req.query;

    const filter = {};
    if (eventType) filter.eventType = eventType;
    if (entityType) filter.entityType = entityType;

    const total = await SystemAuditLog.countDocuments(filter);
    const logs = await SystemAuditLog.find(filter)
      .populate('performedBy', 'fullName name role')
      .sort('-timestamp')
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      status: 'success',
      data: {
        logs,
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all active/failed queue jobs
// @route   GET /api/admin/queue-jobs
exports.getQueueJobs = async (req, res, next) => {
  try {
    const status = req.query.status;
    const filter = {};
    if (status) filter.status = status;

    const jobs = await QueueJob.find(filter)
      .sort('-createdAt')
      .limit(100);

    res.status(200).json({ status: 'success', data: { jobs } });
  } catch (err) {
    next(err);
  }
};

// @desc    Retry a failed job manually
// @route   POST /api/admin/queue-jobs/:id/retry
exports.retryQueueJob = async (req, res, next) => {
  try {
    const job = await QueueJob.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ status: 'error', message: 'Job not found' });
    }

    job.status = 'Pending';
    job.attempts = 0;
    job.lockedBy = null;
    job.lockedAt = null;
    job.nextRetryAt = null;
    job.errorLogs.push({
      message: `Manual retry initiated by admin ${req.user.name}`,
      stack: ''
    });
    
    await job.save();

    await SystemAuditLog.create({
      eventType: 'QUEUE_EXECUTION',
      entityType: 'QueueJob',
      entityId: job._id,
      action: `Manual job retry queued for ${job.queueName}`,
      metadata: { queueName: job.queueName }
    });

    res.status(200).json({ status: 'success', message: 'Job successfully scheduled for retry', data: { job } });
  } catch (err) {
    next(err);
  }
};

// @desc    Get queue health metrics
// @route   GET /api/admin/queue-health
exports.getQueueHealth = async (req, res, next) => {
  try {
    const queueDepth = await QueueJob.countDocuments({ status: 'Pending' });
    const ocrBacklog = await QueueJob.countDocuments({ 
      queueName: 'OCRProcessingQueue', 
      status: { $in: ['Pending', 'Processing'] } 
    });
    const aiBacklog = await QueueJob.countDocuments({ 
      queueName: 'AIExtractionQueue', 
      status: { $in: ['Pending', 'Processing'] } 
    });
    const failedJobs = await QueueJob.countDocuments({ status: 'Failed' });
    
    // Sum of attempts across all jobs
    const attemptsResult = await QueueJob.aggregate([
      { $group: { _id: null, totalAttempts: { $sum: '$attempts' } } }
    ]);
    const retryCount = attemptsResult.length > 0 ? attemptsResult[0].totalAttempts : 0;

    // Average processing time (completed duration from start to finish)
    const completedJobs = await QueueJob.find({ status: 'Completed', startedAt: { $ne: null }, completedAt: { $ne: null } });
    let averageProcessingTime = 0;
    if (completedJobs.length > 0) {
      const totalDuration = completedJobs.reduce((sum, job) => {
        return sum + (job.completedAt - job.startedAt);
      }, 0);
      averageProcessingTime = Math.round(totalDuration / completedJobs.length);
    }

    res.status(200).json({
      status: 'success',
      data: {
        queueDepth,
        ocrBacklog,
        aiBacklog,
        failedJobs,
        retryCount,
        averageProcessingTime
      }
    });
  } catch (err) {
    next(err);
  }
};

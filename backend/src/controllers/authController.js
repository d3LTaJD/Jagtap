const User = require('../models/User');
const Token = require('../models/Token');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const otpUtils = require('../utils/otp');
const ActivityLog = require('../models/ActivityLog');
const Role = require('../models/Role');
const { buildPermissionsForUser, normalizeRole } = require('../config/permissions');

const signToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const buildUserQuery = (identifier) => {
  if (!identifier) return null;
  identifier = identifier.trim();
  if (identifier.includes('@')) {
    return { email: identifier.toLowerCase().trim() };
  } else {
    let cleaned = identifier.replace(/\D/g, '');
    if (cleaned.startsWith('91') && cleaned.length > 10) cleaned = cleaned.substring(2);
    if (cleaned.startsWith('0')) cleaned = cleaned.replace(/^0+/, '');
    if (!cleaned) return { mobile_number: identifier };
    return { mobile_number: { $regex: cleaned + '$' } };
  }
};

const buildLoginResponse = async (user) => {
  // Use centralized RBAC matrix — no database Role lookup needed
  const permissions = buildPermissionsForUser(user);

  const token = signToken(user._id, user.role);
  return { 
    status: 'success', token, 
    user: { 
      _id: user._id,
      id: user._id, 
      name: user.name, 
      fullName: user.name,
      email: user.email,
      mobile: user.mobile_number,
      isActive: user.is_active,
      isVerified: user.is_verified,
      role: user.role, 
      secondaryRole: user.secondaryRole || null,
      permissions 
    } 
  };
};

// @desc    Login
// @route   POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { mobile_number, email, password } = req.body;
    const identifier = mobile_number || email;
    
    if (!identifier || !password) {
      return res.status(400).json({ status: 'error', message: 'Please provide mobile/email and password' });
    }

    const query = buildUserQuery(identifier);
    const user = await User.findOne(query);

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(401).json({ status: 'error', message: 'Account is deactivated' });
    }

    user.last_login = new Date();
    await user.save();

    await ActivityLog.create({
      user_id: user._id,
      action: 'LOGIN',
      module: 'AUTH',
      details: `User logged in from ${req.ip}`
    });

    const responsePayload = await buildLoginResponse(user);
    res.status(200).json(responsePayload);
  } catch (err) {
    next(err);
  }
};

// @desc    Verify OTP / Invite
// @route   POST /api/auth/verify
exports.verifyToken = async (req, res, next) => {
  try {
    const { mobile_number, token } = req.body; // OTP flow sends mobile + otp, Invite sends just token
    if (!token) return res.status(400).json({ status: 'error', message: 'Token/OTP is required' });

    let query = {};
    if (mobile_number) {
      const userQuery = buildUserQuery(mobile_number);
      const user = await User.findOne(userQuery);
      if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
      query.user_id = user._id;
    }

    const tokenRecords = await Token.find(query);
    let validRecord = null;
    
    for (let record of tokenRecords) {
      // Check attempt limit
      if (record.attempts >= 5) {
        await Token.findByIdAndDelete(record._id);
        continue;
      }

      if (record.expires_at > new Date()) {
        const isMatch = await bcrypt.compare(token, record.token);
        if (isMatch) {
          validRecord = record;
          break;
        } else {
          // Increment attempt count on failure
          record.attempts = (record.attempts || 0) + 1;
          if (record.attempts >= 5) {
            await Token.findByIdAndDelete(record._id);
          } else {
            await record.save();
          }
        }
      } else {
        // Purge expired token
        await Token.findByIdAndDelete(record._id);
      }
    }

    if (!validRecord) {
      return res.status(400).json({ status: 'error', message: 'Invalid or expired OTP/Token' });
    }

    res.status(200).json({ status: 'success', message: 'Token verified safely', data: { reference: validRecord._id } });
  } catch (err) {
    next(err);
  }
};

// @desc    Set Password
// @route   POST /api/auth/set-password
exports.setPassword = async (req, res, next) => {
  try {
    const { referenceId, new_password, confirm_password } = req.body; // Reference ID from verify step
    if (new_password !== confirm_password) {
      return res.status(400).json({ status: 'error', message: 'Passwords do not match' });
    }

    const tokenRecord = await Token.findById(referenceId);
    if (!tokenRecord) return res.status(400).json({ status: 'error', message: 'Invalid or already used token reference' });

    if (tokenRecord.expires_at < new Date()) {
      await Token.findByIdAndDelete(tokenRecord._id);
      return res.status(400).json({ status: 'error', message: 'Token reference has expired' });
    }

    const user = await User.findById(tokenRecord.user_id);
    if (!user) {
      await Token.findByIdAndDelete(tokenRecord._id);
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    user.password = new_password;
    user.is_verified = true;
    await user.save();

    // Consume and delete all tokens for this user immediately (single-use)
    await Token.deleteMany({ user_id: user._id });

    res.status(200).json({ status: 'success', data: { user } });
  } catch (err) {
    next(err);
  }
};

exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({ is_active: true }).select('name role department');
    // Return both `name` and `fullName` for frontend compatibility
    const formatted = users.map(u => ({ _id: u._id, name: u.name, fullName: u.name, role: u.role, department: u.department || '' }));
    res.status(200).json({ status: 'success', data: { users: formatted } });
  } catch (err) {
    next(err);
  }
};

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
exports.forgotPassword = async (req, res, next) => {
  try {
    const { mobile_number } = req.body;
    const user = await User.findOne({ mobile_number });
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

    // Rate limiting: Check if an OTP was generated within the last 60 seconds
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentToken = await Token.findOne({
      user_id: user._id,
      type: 'OTP',
      created_at: { $gt: oneMinuteAgo }
    });

    if (recentToken) {
      return res.status(429).json({
        status: 'error',
        message: 'Please wait at least 60 seconds before requesting a new OTP.'
      });
    }

    // Invalidate previous OTP tokens for this user
    await Token.deleteMany({ user_id: user._id, type: 'OTP' });

    const rawOTP = otpUtils.generateOTP();
    const hashedOTP = await otpUtils.hashToken(rawOTP);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    await Token.create({ user_id: user._id, token: hashedOTP, type: 'OTP', attempts: 0, expires_at: expiresAt });

    const { sendEmail } = require('../services/notificationService');
    const subject = 'Password Reset OTP - Workflow Automation';
    const text = `Hello ${user.name},\n\nYou requested a password reset.\nYour OTP is: ${rawOTP}\nIt is valid for 10 minutes.\nIf you did not request this, please ignore this email.`;

    sendEmail({
      userId: user._id,
      subject,
      text
    }).catch(err => console.error('[Auth] Background email error:', err.message));

    console.log(`[AUTH] Forgot password OTP for ${mobile_number} requested.`);

    res.status(200).json({ status: 'success', message: 'OTP sent to email address' });
  } catch (err) {
    next(err);
  }
};

// @desc    Update own profile (name, mobile)
// @route   PATCH /api/auth/profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { fullName, mobile } = req.body;
    const updateFields = {};
    if (fullName) updateFields.name = fullName;
    if (mobile) updateFields.mobile_number = mobile;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('-password');

    const responseUser = {
      _id: user._id,
      fullName: user.name,
      email: user.email,
      mobile: user.mobile_number,
      role: user.role,
      isActive: user.is_active,
      isVerified: user.is_verified,
    };

    res.status(200).json({ status: 'success', data: { user: responseUser } });
  } catch (err) {
    next(err);
  }
};

// @desc    Change own password
// @route   PATCH /api/auth/change-password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ status: 'error', message: 'Both current and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ status: 'error', message: 'New password must be at least 8 characters' });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    await ActivityLog.create({
      user_id: user._id,
      action: 'PASSWORD_CHANGE',
      module: 'AUTH',
      details: 'User changed their password'
    });

    res.status(200).json({ status: 'success', message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
};

// @desc    Get current user profile & latest permissions
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const responsePayload = await buildLoginResponse(req.user);
    res.status(200).json(responsePayload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch user data' });
  }
};

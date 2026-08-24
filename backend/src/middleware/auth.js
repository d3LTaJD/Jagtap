const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { PERMISSION_MATRIX, normalizeRole, getUserRoles, hasPermission } = require('../config/permissions');

exports.protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Not authorized to access this route' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.userId || decoded.id);
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'User belonging to token no longer exists' });
    }
    next();
  } catch (error) {
    return res.status(401).json({ status: 'error', message: 'Token is invalid or expired' });
  }
};

// Re-export normalizeRole as getRoleCode for backward compatibility
const getRoleCode = normalizeRole;

const getEquivalentRoles = (role) => {
  if (!role) return [];
  const { ROLE_ALIASES } = require('../config/permissions');
  const normalized = role.toUpperCase().trim();
  for (const [shortCode, aliases] of Object.entries(ROLE_ALIASES)) {
    if (shortCode === normalized || aliases.some(a => a.toUpperCase() === normalized)) {
      return [shortCode, ...aliases, shortCode.toLowerCase(), ...aliases.map(a => a.toLowerCase())];
    }
  }
  return [role, role.toUpperCase(), role.toLowerCase()];
};

exports.getRoleCode = getRoleCode;
exports.getEquivalentRoles = getEquivalentRoles;

/**
 * Role-based route guard using the centralized RBAC matrix.
 * Checks if ANY of the user's roles (primary + secondary) is in the allowed list.
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    const userRoles = getUserRoles(req.user);

    const isAuthorized = roles.some(r => {
      const normalizedR = normalizeRole(r);
      return userRoles.includes(normalizedR);
    });

    if (!isAuthorized) {
      return res.status(403).json({ status: 'error', message: `User role ${req.user.role} is not authorized` });
    }
    next();
  };
};

/**
 * Permission-based route guard using the centralized RBAC matrix.
 * Checks the PERMISSION_MATRIX directly — no database lookup needed.
 */
exports.requirePermission = (moduleName, action) => {
  return (req, res, next) => {
    if (hasPermission(req.user, moduleName, action)) {
      return next();
    }

    return res.status(403).json({
      status: 'error',
      message: `Not authorized to perform ${action} on ${moduleName}`
    });
  };
};

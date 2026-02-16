const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { PERMISSIONS } = require('../config/roles');
const logger = require('../config/logger');

/**
 * Verify JWT and attach user to req.user.
 */
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        return res.status(401).json({ status: 'error', message: 'Not authorized' });
      }
      return next();
    } catch (error) {
      return res.status(401).json({ status: 'error', message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Not authorized, no token' });
  }
};

/**
 * Simple role-list guard.
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ status: 'error', message: 'Access denied' });
    }
    next();
  };
};

/**
 * Granular permission guard driven by config/roles.js.
 */
const permit = (permission) => {
  return (req, res, next) => {
    const allowedRoles = PERMISSIONS[permission];
    if (!allowedRoles) {
      logger.error(`Unknown permission key: ${permission}`);
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ status: 'error', message: 'Access denied' });
    }
    next();
  };
};

module.exports = { protect, authorize, permit };

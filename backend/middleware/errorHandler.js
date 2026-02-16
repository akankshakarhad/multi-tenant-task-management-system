const logger = require('../config/logger');

/**
 * Centralized error-handling middleware.
 * Catches all errors thrown or passed via next(err) and returns
 * a consistent JSON response without leaking internal details.
 */
const errorHandler = (err, req, res, _next) => {
  // Log the full error internally
  logger.error(err.message, {
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user?._id,
  });

  // Mongoose validation error → 400
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: messages,
    });
  }

  // Mongoose duplicate key → 409
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      status: 'error',
      message: `Duplicate value for "${field}"`,
    });
  }

  // Mongoose bad ObjectId → 400
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid ID format',
    });
  }

  // JWT errors → 401
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 'error',
      message: 'Authentication failed',
    });
  }

  // Default — never expose raw message in production
  const statusCode = err.statusCode || 500;
  const message =
    statusCode === 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error';

  res.status(statusCode).json({
    status: 'error',
    message,
  });
};

module.exports = errorHandler;

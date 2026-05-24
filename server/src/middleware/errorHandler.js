import mongoose from 'mongoose';
import { ApiError } from '../utils/apiError.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Centralized error handler — never leak stack traces or DB details in production.
 */
export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let status = err.statusCode || err.status || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Internal Server Error';

  if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join('; ');
  } else if (err.code === 11000) {
    status = 409;
    code = 'DUPLICATE_KEY';
    message = 'Duplicate record';
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401;
    code = 'INVALID_TOKEN';
    message = 'Not authorized';
  }

  if (status >= 500) {
    logger.error(err);
    if (env.isProd) {
      message = 'Internal Server Error';
      code = 'INTERNAL_ERROR';
    }
  } else if (!env.isProd) {
    logger.warn(message);
  }

  res.status(status).json({
    success: false,
    code,
    message,
    ...(!env.isProd && err.stack && { stack: err.stack }),
  });
}

import { ApiError } from '../utils/apiError.js';

export function notFoundHandler(req, res, next) {
  next(new ApiError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

/**
 * Consistent API errors for centralized error handler.
 */
export class ApiError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'ApiError';
  }

  static badRequest(message, code = 'BAD_REQUEST') {
    return new ApiError(message, 400, code);
  }

  static unauthorized(message = 'Not authorized', code = 'UNAUTHORIZED') {
    return new ApiError(message, 401, code);
  }

  static forbidden(message = 'Forbidden', code = 'FORBIDDEN') {
    return new ApiError(message, 403, code);
  }

  static locked(message = 'Account temporarily locked', code = 'ACCOUNT_LOCKED') {
    return new ApiError(message, 423, code);
  }

  static tooMany(message = 'Too many requests', code = 'RATE_LIMITED') {
    return new ApiError(message, 429, code);
  }
}

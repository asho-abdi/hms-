/**
 * express-validator runner — returns consistent 400 responses.
 */
import { validationResult } from 'express-validator';
import { ApiError } from '../utils/apiError.js';

export function validate(validations) {
  return async (req, res, next) => {
    await Promise.all(validations.map((v) => v.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const first = errors.array()[0];
      const message = first.msg || 'Validation failed';
      return next(ApiError.badRequest(message, 'VALIDATION_ERROR'));
    }
    next();
  };
}

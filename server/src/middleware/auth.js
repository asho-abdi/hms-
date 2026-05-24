import { User } from '../models/User.js';
import { verifyAccessToken } from '../utils/token.js';
import { ApiError } from '../utils/apiError.js';

function getBearerToken(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  return h.slice(7);
}

/** JWT authentication — required on all protected HMS routes. */
export async function protect(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      throw ApiError.unauthorized('Not authorized, no token');
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId).select('-password -refreshTokenHash');
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('Not authorized, user inactive or missing');
    }
    req.user = user;
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    next(ApiError.unauthorized('Not authorized, invalid token'));
  }
}

/** Role-based authorization — compose after protect(). */
export function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden('Forbidden for this role'));
    }
    next();
  };
}

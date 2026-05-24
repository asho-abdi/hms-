/**
 * Short-lived idempotency for sensitive POST/PATCH (e.g. payment) to block duplicate submits.
 */
const cache = new Map();
const TTL_MS = 60 * 1000;

function prune() {
  const now = Date.now();
  for (const [key, exp] of cache.entries()) {
    if (exp < now) cache.delete(key);
  }
}

export function idempotencyGuard(req, res, next) {
  const key = req.headers['x-idempotency-key'];
  if (!key || typeof key !== 'string' || key.length > 128) {
    return next();
  }

  prune();
  const cacheKey = `${req.user?._id || 'anon'}:${req.method}:${req.path}:${key}`;
  if (cache.has(cacheKey)) {
    return res.status(409).json({
      success: false,
      code: 'DUPLICATE_REQUEST',
      message: 'Duplicate request — already processed',
    });
  }

  cache.set(cacheKey, Date.now() + TTL_MS);
  next();
}

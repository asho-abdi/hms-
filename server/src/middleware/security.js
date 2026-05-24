/**
 * HTTP hardening: Helmet, CORS allowlist, HPP, MongoDB operator sanitization.
 */
import helmet from 'helmet';
import cors from 'cors';
import hpp from 'hpp';
import mongoSanitize from 'express-mongo-sanitize';
import { resolveClientOrigins, env } from '../config/env.js';

export function applySecurityMiddleware(app) {
  // Trust reverse proxy (Render, Railway, Vercel rewrites) for correct client IP / HTTPS.
  if (env.trustProxy) {
    app.set('trust proxy', 1);
  }

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: env.isProd ? undefined : false,
    })
  );

  const allowedOrigins = resolveClientOrigins();

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        if (!env.isProd && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }
        callback(new ApiErrorCors());
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key'],
    })
  );

  // Prevent HTTP parameter pollution (duplicate query keys).
  app.use(hpp());

  // Strip keys like $gt from user input — MongoDB injection defense.
  app.use(
    mongoSanitize({
      replaceWith: '_',
      onSanitize: ({ req, key }) => {
        if (!env.isProd) {
          req.sanitizedKeys = req.sanitizedKeys || [];
          req.sanitizedKeys.push(key);
        }
      },
    })
  );
}

function ApiErrorCors() {
  const err = new Error('Origin not allowed by CORS policy');
  err.status = 403;
  return err;
}

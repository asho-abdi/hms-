/**
 * Central environment validation for production deployments (Render, Railway, etc.).
 * Fails fast when required secrets are missing — never ship with dev defaults in prod.
 */

const isProd = process.env.NODE_ENV === 'production';

export function assertProductionEnv() {
  if (!isProd) return;

  const required = ['JWT_SECRET', 'MONGODB_URI', 'CLIENT_ORIGIN'];
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error(
      `[HMS] Missing required environment variables in production: ${missing.join(', ')}`
    );
  }

  if ((process.env.JWT_SECRET || '').length < 32) {
    throw new Error('[HMS] JWT_SECRET must be at least 32 characters in production');
  }
}

export function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) return secret;

  if (isProd) {
    throw new Error('[HMS] JWT_SECRET is required in production');
  }

  console.warn(
    '[HMS] Warning: JWT_SECRET not set; using insecure development default only'
  );
  return 'dev-only-insecure-secret-change-me';
}

export function resolveMongoUri() {
  const uri = process.env.MONGODB_URI?.trim();
  if (uri) return uri;
  if (isProd) {
    throw new Error('[HMS] MONGODB_URI is required in production');
  }
  return 'mongodb://127.0.0.1:27017/hms';
}

export function resolveClientOrigins() {
  const raw = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export const env = {
  isProd,
  port: Number(process.env.PORT) || 5001,
  trustProxy: process.env.TRUST_PROXY === 'true' || isProd,
  accessTokenExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
  refreshTokenExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  refreshCookieName: process.env.REFRESH_COOKIE_NAME || 'hms_refresh',
  maxLoginAttempts: Number(process.env.MAX_LOGIN_ATTEMPTS) || 5,
  lockMinutes: Number(process.env.ACCOUNT_LOCK_MINUTES) || 15,
};

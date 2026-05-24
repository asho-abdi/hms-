import { env } from '../config/env.js';

/** Cross-site cookies when API and SPA are on different domains (e.g. Render + Vercel). */
function cookieOptions() {
  const crossSite = process.env.CROSS_SITE_COOKIES === 'true';
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: crossSite ? 'none' : env.isProd ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  };
}

export function setRefreshCookie(res, refreshToken) {
  res.cookie(env.refreshCookieName, refreshToken, cookieOptions());
}

export function clearRefreshCookie(res) {
  res.clearCookie(env.refreshCookieName, cookieOptions());
}

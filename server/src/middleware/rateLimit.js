/**
 * Rate limits: strict login, general API, and upload endpoints.
 */
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const jsonHandler = (message) => (req, res) => {
  res.status(429).json({
    success: false,
    code: 'RATE_LIMITED',
    message,
  });
};

/** Brute-force protection on authentication. */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isProd ? 10 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: jsonHandler('Too many login attempts. Try again in 15 minutes.'),
});

/** General API throttle per IP. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.isProd ? 200 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler('Too many requests. Please slow down.'),
});

/** Upload endpoints — prevent abuse. */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.isProd ? 30 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler('Too many uploads. Try again shortly.'),
});

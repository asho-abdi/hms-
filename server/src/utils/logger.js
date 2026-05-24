/**
 * Lightweight logger — suppresses noisy output in production except errors.
 */
import { env } from '../config/env.js';

export const logger = {
  info(...args) {
    if (!env.isProd) console.log('[HMS]', ...args);
  },
  warn(...args) {
    console.warn('[HMS]', ...args);
  },
  error(...args) {
    console.error('[HMS]', ...args);
  },
};

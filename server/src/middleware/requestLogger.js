/**
 * HTTP request logging — concise in production, verbose in development.
 */
import morgan from 'morgan';
import { env } from '../config/env.js';

export const requestLogger = morgan(env.isProd ? 'combined' : 'dev', {
  skip: (req) => req.path === '/api/health',
});

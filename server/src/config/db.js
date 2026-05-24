import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * MongoDB connection — URI from environment only in production.
 */
export async function connectDB(uri) {
  mongoose.set('strictQuery', true);

  const options = {
    autoIndex: !env.isProd,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
  };

  await mongoose.connect(uri, options);
  logger.info('MongoDB connected');
}

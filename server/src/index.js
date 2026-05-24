import 'dotenv/config';
import path from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { assertProductionEnv, resolveJwtSecret, resolveMongoUri, env } from './config/env.js';
import { connectDB } from './config/db.js';
import { ensureDefaultUsers } from './bootstrap/ensureDefaultUsers.js';
import { ensureLabCatalog } from './bootstrap/ensureLabCatalog.js';
import { migrateCashierToReceptionist } from './bootstrap/migrateCashierToReceptionist.js';
import { migratePatientGenderOtherToMale } from './bootstrap/migratePatientGender.js';
import { applySecurityMiddleware } from './middleware/security.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { requestLogger } from './middleware/requestLogger.js';
import { notFoundHandler } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

import authRoutes from './routes/authRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import visitRoutes from './routes/visitRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import labRoutes from './routes/labRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import usersRoutes from './routes/usersRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';

assertProductionEnv();
process.env.JWT_SECRET = resolveJwtSecret();

const app = express();

applySecurityMiddleware(app);
app.use(requestLogger);
app.use(cookieParser());
app.use(express.json({ limit: '128kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), { maxAge: env.isProd ? '1d' : 0 }));
app.use('/api/uploads', uploadRoutes);

/** Health check for Render/Railway — no auth, minimal surface. */
app.get('/api/health', async (_req, res) => {
  const dbOk = mongoose.connection.readyState === 1;
  res.status(dbOk ? 200 : 503).json({
    ok: dbOk,
    service: 'hms-api',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', usersRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  const uri = resolveMongoUri();
  await connectDB(uri);
  await migrateCashierToReceptionist();
  await ensureDefaultUsers();
  await ensureLabCatalog();
  await migratePatientGenderOtherToMale();

  const server = app.listen(env.port, () => {
    logger.info(`HMS API listening on port ${env.port} (${env.isProd ? 'production' : 'development'})`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(
        `Port ${env.port} is in use. Stop the other process or set PORT in server/.env`
      );
    } else {
      logger.error('Server error:', err);
    }
    process.exit(1);
  });
}

start().catch((err) => {
  logger.error(err);
  process.exit(1);
});

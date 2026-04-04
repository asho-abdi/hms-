import 'dotenv/config';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import { ensureDefaultUsers } from './bootstrap/ensureDefaultUsers.js';
import { ensureLabCatalog } from './bootstrap/ensureLabCatalog.js';
import { migrateCashierToReceptionist } from './bootstrap/migrateCashierToReceptionist.js';
import { migratePatientGenderOtherToMale } from './bootstrap/migratePatientGender.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import visitRoutes from './routes/visitRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import labRoutes from './routes/labRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import usersRoutes from './routes/usersRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';

const app = express();
const PORT = process.env.PORT || 5001;
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const isProd = process.env.NODE_ENV === 'production';

// In development, reflect any localhost origin so Vite can use 5173, 5174, etc.
app.use(
  cors({
    origin: isProd ? clientOrigin : true,
    credentials: true,
  })
);
app.use(express.json());

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/api/uploads', uploadRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'hms-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', usersRoutes);

app.use(errorHandler);

async function start() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hms';
  if (!process.env.JWT_SECRET) {
    console.warn('Warning: JWT_SECRET not set; using insecure default for development only');
    process.env.JWT_SECRET = 'dev-only-insecure-secret-change-me';
  }
  await connectDB(uri);
  await migrateCashierToReceptionist();
  await ensureDefaultUsers();
  await ensureLabCatalog();
  await migratePatientGenderOtherToMale();

  const server = app.listen(PORT, () => {
    console.log(`HMS API listening on port ${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\n[HMS] Port ${PORT} is already in use. Another process (often a previous HMS server) is using it.\n` +
          `  • Stop the other terminal/process, or\n` +
          `  • Set a different port: PORT=5001 in server/.env\n` +
          `  • Windows: netstat -ano | findstr :${PORT}  then  taskkill /PID <pid> /F\n`
      );
    } else {
      console.error('[HMS] Server error:', err);
    }
    process.exit(1);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});

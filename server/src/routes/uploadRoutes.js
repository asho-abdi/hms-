import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { protect, requireRoles } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { ROLES } from '../config/constants.js';

const uploadRoot = path.join(process.cwd(), 'uploads', 'lab-imaging');
fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safe = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `${crypto.randomUUID()}${safe}`);
  },
});

const MAX_BYTES = 8 * 1024 * 1024;

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (!allowedExt.includes(ext)) {
      return cb(new Error('File extension not allowed'));
    }
    if (/^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF, or WebP images are allowed'));
    }
  },
});

const router = Router();

router.post('/lab-imaging', uploadLimiter, protect, requireRoles(ROLES.LAB, ROLES.ADMIN), (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 8 MB)' : 'Upload failed';
        return res.status(400).json({ message: msg });
      }
      return res.status(400).json({ message: err.message || 'Invalid file' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const publicPath = `/uploads/lab-imaging/${req.file.filename}`;
    res.json({ url: publicPath });
  });
});

export default router;

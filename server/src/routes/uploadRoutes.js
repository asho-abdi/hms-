import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { protect, requireRoles } from '../middleware/auth.js';
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

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF, or WebP images are allowed'));
    }
  },
});

const router = Router();

router.post('/lab-imaging', protect, requireRoles(ROLES.LAB, ROLES.ADMIN), (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 12 MB)' : 'Upload failed';
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

import { Router } from 'express';
import { login, me, refresh, logout } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginValidation } from '../validators/authValidators.js';
import { loginLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post('/login', loginLimiter, validate(loginValidation), login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', protect, me);

export default router;

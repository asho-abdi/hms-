import { Router } from 'express';
import { listDoctors } from '../controllers/usersController.js';
import { protect, requireRoles } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.get('/doctors', protect, requireRoles(ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR), listDoctors);

export default router;

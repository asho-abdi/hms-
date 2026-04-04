import { Router } from 'express';
import {
  listAppointments,
  todayAppointments,
  createAppointment,
  checkInAppointment,
} from '../controllers/appointmentController.js';
import { protect, requireRoles } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.get('/today', protect, requireRoles(ROLES.ADMIN, ROLES.RECEPTIONIST), todayAppointments);
router.get('/', protect, requireRoles(ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR), listAppointments);
router.post('/', protect, requireRoles(ROLES.ADMIN, ROLES.RECEPTIONIST), createAppointment);
router.post('/:id/check-in', protect, requireRoles(ROLES.ADMIN, ROLES.RECEPTIONIST), checkInAppointment);

export default router;

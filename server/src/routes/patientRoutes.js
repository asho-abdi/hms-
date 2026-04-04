import { Router } from 'express';
import {
  listPatients,
  createPatient,
  getPatient,
  updatePatient,
  deletePatient,
  getPatientReport,
} from '../controllers/patientController.js';
import { protect, requireRoles } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = Router();

const staff = [ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR];

router.get('/', protect, requireRoles(...staff), listPatients);
router.post('/', protect, requireRoles(ROLES.ADMIN, ROLES.RECEPTIONIST), createPatient);
router.get('/:id/report', protect, requireRoles(...staff, ROLES.LAB), getPatientReport);
router.get('/:id', protect, requireRoles(...staff), getPatient);
router.put('/:id', protect, requireRoles(ROLES.ADMIN, ROLES.RECEPTIONIST), updatePatient);
router.delete('/:id', protect, requireRoles(ROLES.ADMIN), deletePatient);

export default router;

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
import { validate } from '../middleware/validate.js';
import {
  createPatientValidation,
  updatePatientValidation,
  mongoIdParam,
} from '../validators/patientValidators.js';
import { ROLES } from '../config/constants.js';

const router = Router();

const staff = [ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR];

router.get('/', protect, requireRoles(...staff), listPatients);
router.post(
  '/',
  protect,
  requireRoles(ROLES.ADMIN, ROLES.RECEPTIONIST),
  validate(createPatientValidation),
  createPatient
);
router.get(
  '/:id/report',
  protect,
  requireRoles(...staff, ROLES.LAB),
  validate(mongoIdParam),
  getPatientReport
);
router.get('/:id', protect, requireRoles(...staff), validate(mongoIdParam), getPatient);
router.put(
  '/:id',
  protect,
  requireRoles(ROLES.ADMIN, ROLES.RECEPTIONIST),
  validate(updatePatientValidation),
  updatePatient
);
router.delete('/:id', protect, requireRoles(ROLES.ADMIN), validate(mongoIdParam), deletePatient);

export default router;

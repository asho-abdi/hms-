import { Router } from 'express';
import {
  listVisits,
  doctorMyPatients,
  doctorQueue,
  doctorRecentCompleted,
  getVisit,
  getMedicationPresets,
  createWalkInVisit,
  updateVisitDoctor,
  requestLab,
  completeVisit,
  reopenVisit,
} from '../controllers/visitController.js';
import { protect, requireRoles } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.get('/doctor-queue', protect, requireRoles(ROLES.ADMIN, ROLES.DOCTOR), doctorQueue);
router.get('/recent-completed', protect, requireRoles(ROLES.ADMIN, ROLES.DOCTOR), doctorRecentCompleted);
router.get('/my-patients', protect, requireRoles(ROLES.DOCTOR, ROLES.ADMIN), doctorMyPatients);
router.get('/', protect, requireRoles(ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.LAB), listVisits);
router.post('/walk-in', protect, requireRoles(ROLES.ADMIN, ROLES.RECEPTIONIST), createWalkInVisit);
router.get(
  '/medication-presets',
  protect,
  requireRoles(ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST, ROLES.LAB),
  getMedicationPresets
);
router.get('/:id', protect, requireRoles(ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.LAB), getVisit);
router.patch('/:id', protect, requireRoles(ROLES.ADMIN, ROLES.DOCTOR), updateVisitDoctor);
router.post('/:id/lab-request', protect, requireRoles(ROLES.DOCTOR, ROLES.ADMIN), requestLab);
router.post('/:id/complete', protect, requireRoles(ROLES.DOCTOR, ROLES.ADMIN), completeVisit);
router.post('/:id/reopen', protect, requireRoles(ROLES.DOCTOR, ROLES.ADMIN), reopenVisit);

export default router;

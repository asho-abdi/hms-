import { Router } from 'express';
import {
  listLabOrders,
  getLabOrder,
  submitLabResults,
  eligibleVisitsForLab,
  createLabOrder,
  getLabReport,
  getLabCatalog,
  startLabOrder,
} from '../controllers/labController.js';
import { protect, requireRoles } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.get('/eligible-visits', protect, requireRoles(ROLES.ADMIN, ROLES.DOCTOR), eligibleVisitsForLab);
router.get(
  '/catalog',
  protect,
  requireRoles(ROLES.ADMIN, ROLES.DOCTOR, ROLES.LAB, ROLES.RECEPTIONIST),
  getLabCatalog
);
router.post('/orders', protect, requireRoles(ROLES.ADMIN, ROLES.DOCTOR), createLabOrder);

router.get('/orders', protect, requireRoles(ROLES.ADMIN, ROLES.LAB, ROLES.DOCTOR), listLabOrders);
router.get('/orders/:id/report', protect, requireRoles(ROLES.ADMIN, ROLES.DOCTOR, ROLES.LAB, ROLES.RECEPTIONIST), getLabReport);
router.get('/orders/:id', protect, requireRoles(ROLES.ADMIN, ROLES.LAB, ROLES.DOCTOR), getLabOrder);
router.patch('/orders/:id/start', protect, requireRoles(ROLES.ADMIN, ROLES.LAB), startLabOrder);
router.patch('/orders/:id/results', protect, requireRoles(ROLES.ADMIN, ROLES.LAB), submitLabResults);

export default router;

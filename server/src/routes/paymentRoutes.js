import { Router } from 'express';
import { listUnpaid, listPaymentReport, payVisit } from '../controllers/paymentController.js';
import { protect, requireRoles } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.get('/report', protect, requireRoles(ROLES.ADMIN, ROLES.RECEPTIONIST), listPaymentReport);
router.get('/unpaid', protect, requireRoles(ROLES.ADMIN, ROLES.RECEPTIONIST), listUnpaid);
router.patch('/visit/:visitId/pay', protect, requireRoles(ROLES.ADMIN, ROLES.RECEPTIONIST), payVisit);

export default router;

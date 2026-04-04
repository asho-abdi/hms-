import { Router } from 'express';
import {
  dashboardStats,
  adminOverview,
  listUsers,
  createStaffUser,
  updateStaffUser,
  deleteStaffUser,
  resetOperationalData,
} from '../controllers/adminController.js';
import { protect, requireRoles } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(protect, requireRoles(ROLES.ADMIN));

router.get('/stats', dashboardStats);
router.get('/overview', adminOverview);
router.get('/users', listUsers);
router.post('/users', createStaffUser);
router.patch('/users/:id', updateStaffUser);
router.delete('/users/:id', deleteStaffUser);
router.post('/reset-operational-data', resetOperationalData);

export default router;

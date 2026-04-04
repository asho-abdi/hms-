import { User } from '../models/User.js';
import { ROLES } from '../config/constants.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listDoctors = asyncHandler(async (req, res) => {
  const items = await User.find({ role: ROLES.DOCTOR, isActive: true })
    .select('fullName email speciality')
    .sort({ fullName: 1 })
    .lean();
  res.json({ items });
});

import { ROLES } from './constants.js';

/** Default demo accounts (used by `npm run seed` and startup bootstrap when DB is empty). */
export const SEED_USERS = [
  { email: 'admin@hms.local', password: 'Admin123!', fullName: 'System Admin', role: ROLES.ADMIN },
  {
    email: 'doctor@hms.local',
    password: 'Doctor123!',
    fullName: 'Dr. Sarah Chen',
    role: ROLES.DOCTOR,
    speciality: 'General medicine',
  },
  { email: 'reception@hms.local', password: 'Recep123!', fullName: 'Alex Morgan', role: ROLES.RECEPTIONIST },
  { email: 'lab@hms.local', password: 'Lab123!', fullName: 'Jordan Lee', role: ROLES.LAB },
];

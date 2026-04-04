import { User } from '../models/User.js';
import { SEED_USERS } from '../config/seedUsers.js';

/**
 * Ensures every demo account in SEED_USERS exists. Creates only missing users (does not reset passwords).
 * Disable entirely with DISABLE_AUTO_SEED=true.
 */
export async function ensureDefaultUsers() {
  if (process.env.DISABLE_AUTO_SEED === 'true') {
    return;
  }

  let created = 0;
  for (const u of SEED_USERS) {
    const existing = await User.findOne({ email: u.email });
    if (existing) continue;
    await User.create(u);
    created += 1;
    console.log('[HMS] Created missing demo user:', u.email, u.role);
  }

  if (created > 0) {
    console.log(
      `[HMS] ${created} demo account(s) added. Admin: admin@hms.local / Admin123! — run npm run seed:force to reset passwords if login still fails.`
    );
  }
}

import { User } from '../models/User.js';

/** One-time style migration: cashier duties are handled by reception. */
export async function migrateCashierToReceptionist() {
  const res = await User.updateMany({ role: 'CASHIER' }, { $set: { role: 'RECEPTIONIST' } });
  if (res.modifiedCount > 0) {
    console.log(`[HMS] Migrated ${res.modifiedCount} account(s) from CASHIER to RECEPTIONIST`);
  }
}

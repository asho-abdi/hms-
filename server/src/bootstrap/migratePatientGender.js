import { Patient } from '../models/Patient.js';

/** Legacy DB values: enum no longer allows "other". */
export async function migratePatientGenderOtherToMale() {
  const r = await Patient.updateMany({ gender: 'other' }, { $set: { gender: 'male' } });
  if (r.modifiedCount > 0) {
    console.log(`[HMS] Updated ${r.modifiedCount} patient record(s): gender "other" → "male".`);
  }
}

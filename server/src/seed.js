import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from './models/User.js';
import { SEED_USERS } from './config/seedUsers.js';

const force = process.argv.includes('--force');

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hms';
  await mongoose.connect(uri);
  console.log('Connected');

  for (const u of SEED_USERS) {
    const existing = await User.findOne({ email: u.email }).select('+password');
    if (existing) {
      if (force) {
        existing.password = u.password;
        existing.fullName = u.fullName;
        existing.role = u.role;
        if (u.speciality !== undefined) existing.speciality = u.speciality || '';
        await existing.save();
        console.log('Updated password (force):', u.email);
      } else {
        console.log('Skip (exists):', u.email);
      }
      continue;
    }
    await User.create(u);
    console.log('Created:', u.email, u.role);
  }

  if (force) {
    console.log('Force mode: all seed user passwords were reset to match seedUsers.js');
  }

  await mongoose.disconnect();
  console.log('Done');
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});

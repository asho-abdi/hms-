import fs from 'fs/promises';
import path from 'path';
import { User } from '../models/User.js';
import { Patient } from '../models/Patient.js';
import { Visit } from '../models/Visit.js';
import { LabOrder } from '../models/LabOrder.js';
import { Appointment } from '../models/Appointment.js';
import { Payment } from '../models/Payment.js';
import { APPOINTMENT_STATUS, ROLES } from '../config/constants.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const RESET_CONFIRM_PHRASE = 'RESET_ALL_PATIENT_DATA';

async function clearLabImagingUploads() {
  const dir = path.join(process.cwd(), 'uploads', 'lab-imaging');
  try {
    const names = await fs.readdir(dir);
    await Promise.all(names.map((n) => fs.unlink(path.join(dir, n))));
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      console.warn('[HMS] Lab imaging uploads cleanup:', err.message);
    }
  }
}

const STAFF_ROLES = [ROLES.DOCTOR, ROLES.RECEPTIONIST, ROLES.LAB, ROLES.ADMIN];

export const dashboardStats = asyncHandler(async (req, res) => {
  const [users, patients, visits, appointments] = await Promise.all([
    User.countDocuments(),
    Patient.countDocuments(),
    Visit.countDocuments(),
    Appointment.countDocuments({ status: APPOINTMENT_STATUS.SCHEDULED }),
  ]);

  const byRole = await User.aggregate([
    { $group: { _id: '$role', count: { $sum: 1 } } },
  ]);

  res.json({
    counts: { users, patients, visits, scheduledAppointments: appointments },
    usersByRole: byRole.reduce((acc, r) => {
      acc[r._id] = r.count;
      return acc;
    }, {}),
  });
});

/** Overview: counts, doctors ranked by distinct patients seen. (Patient table uses GET /patients.) */
export const adminOverview = asyncHandler(async (req, res) => {
  const [usersCount, patientsCount, visitsCount, appointmentsCount, byRole, doctorsRaw] = await Promise.all([
    User.countDocuments(),
    Patient.countDocuments(),
    Visit.countDocuments(),
    Appointment.countDocuments({ status: APPOINTMENT_STATUS.SCHEDULED }),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    Visit.aggregate([
        { $group: { _id: '$doctor', patientIds: { $addToSet: '$patient' } } },
        { $project: { doctorId: '$_id', patientCount: { $size: '$patientIds' } } },
        { $sort: { patientCount: -1 } },
        {
          $lookup: {
            from: 'users',
            localField: 'doctorId',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
        { $match: { 'user.role': ROLES.DOCTOR } },
        {
          $project: {
            _id: '$doctorId',
            fullName: '$user.fullName',
            email: '$user.email',
            speciality: '$user.speciality',
            patientCount: 1,
          },
        },
      ]),
  ]);

  const doctorsRanked = doctorsRaw.map((d, i) => ({
    ...d,
    rank: i + 1,
  }));

  res.json({
    counts: {
      users: usersCount,
      patients: patientsCount,
      visits: visitsCount,
      scheduledAppointments: appointmentsCount,
    },
    usersByRole: byRole.reduce((acc, r) => {
      acc[r._id] = r.count;
      return acc;
    }, {}),
    doctorsRanked,
  });
});

export const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find()
    .select('email fullName role speciality visitFee isActive createdAt')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ items: users });
});

export const createStaffUser = asyncHandler(async (req, res) => {
  const { email, password, fullName, role, speciality, visitFee } = req.body;
  if (!STAFF_ROLES.includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }
  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) return res.status(400).json({ message: 'Email already registered' });

  const spec = role === ROLES.DOCTOR ? String(speciality ?? '').trim() : '';
  const vf = role === ROLES.DOCTOR ? Math.max(0, Number(visitFee) || 0) : 0;

  const user = await User.create({
    email: email.toLowerCase(),
    password,
    fullName,
    role,
    speciality: spec,
    visitFee: vf,
  });

  res.status(201).json({
    id: user._id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    speciality: user.speciality,
    visitFee: user.visitFee,
  });
});

export const updateStaffUser = asyncHandler(async (req, res) => {
  const { fullName, role, email, isActive, password, speciality, visitFee } = req.body;
  const user = await User.findById(req.params.id).select('+password');
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (fullName !== undefined) user.fullName = String(fullName).trim();
  if (role !== undefined) {
    if (!STAFF_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    user.role = role;
    if (role !== ROLES.DOCTOR) {
      user.speciality = '';
      user.visitFee = 0;
    }
  }
  if (speciality !== undefined) {
    if (user.role === ROLES.DOCTOR) {
      user.speciality = String(speciality).trim();
    }
  }
  if (visitFee !== undefined && user.role === ROLES.DOCTOR) {
    user.visitFee = Math.max(0, Number(visitFee) || 0);
  }
  if (email !== undefined) {
    const nextEmail = String(email).toLowerCase().trim();
    const clash = await User.findOne({ email: nextEmail, _id: { $ne: user._id } });
    if (clash) return res.status(400).json({ message: 'Email already in use' });
    user.email = nextEmail;
  }
  if (isActive !== undefined) {
    if (!isActive && String(user._id) === String(req.user._id)) {
      return res.status(400).json({ message: 'You cannot deactivate your own account' });
    }
    user.isActive = Boolean(isActive);
  }
  if (password !== undefined && password !== '') {
    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    user.password = password;
  }

  await user.save();

  const fresh = await User.findById(user._id)
    .select('email fullName role speciality visitFee isActive createdAt')
    .lean();
  res.json(fresh);
});

/** Deactivates the user (soft delete). Users with visit history cannot be hard-deleted. */
export const deleteStaffUser = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) {
    return res.status(400).json({ message: 'You cannot remove your own account' });
  }

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const [visitCount, labCount] = await Promise.all([
    Visit.countDocuments({ doctor: req.params.id }),
    LabOrder.countDocuments({ doctor: req.params.id }),
  ]);
  if (visitCount > 0 || labCount > 0) {
    user.isActive = false;
    await user.save();
    return res.json({
      message:
        'User deactivated (linked to visits or lab orders; account disabled instead of removed).',
      deactivated: true,
    });
  }

  await User.findByIdAndDelete(req.params.id);
  res.json({ message: 'User removed', deleted: true });
});

/**
 * Remove all operational clinical data (patients, visits, appointments, lab orders, payments).
 * Preserves staff users and lab catalog. Clears uploaded lab imaging files.
 */
export const resetOperationalData = asyncHandler(async (req, res) => {
  const phrase = typeof req.body?.confirm === 'string' ? req.body.confirm.trim() : '';
  if (phrase !== RESET_CONFIRM_PHRASE) {
    return res.status(400).json({
      message: `Confirmation required. Send JSON: { "confirm": "${RESET_CONFIRM_PHRASE}" }`,
    });
  }

  const [labOrders, payments, visits, appointments, patients] = await Promise.all([
    LabOrder.deleteMany({}),
    Payment.deleteMany({}),
    Visit.deleteMany({}),
    Appointment.deleteMany({}),
    Patient.deleteMany({}),
  ]);

  await clearLabImagingUploads();

  res.json({
    message:
      'Operational data cleared. Staff accounts and the lab test catalog were not changed.',
    deleted: {
      labOrders: labOrders.deletedCount ?? 0,
      payments: payments.deletedCount ?? 0,
      visits: visits.deletedCount ?? 0,
      appointments: appointments.deletedCount ?? 0,
      patients: patients.deletedCount ?? 0,
    },
  });
});

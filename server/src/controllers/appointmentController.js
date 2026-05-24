import { Appointment } from '../models/Appointment.js';
import { Visit } from '../models/Visit.js';
import { User } from '../models/User.js';
import { Patient } from '../models/Patient.js';
import { ROLES } from '../config/constants.js';
import { APPOINTMENT_STATUS } from '../config/constants.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createVisitWithPayment,
  findVisitForAppointment,
} from '../services/visitEncounter.js';

export const listAppointments = asyncHandler(async (req, res) => {
  const { from, to, doctor, status } = req.query;
  const filter = {};
  if (from || to) {
    filter.date_time = {};
    if (from) filter.date_time.$gte = new Date(from);
    if (to) filter.date_time.$lte = new Date(to);
  }
  if (doctor) filter.doctor = doctor;
  if (status) filter.status = status;

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 30));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Appointment.find(filter)
      .populate('patient')
      .populate('doctor', 'fullName email role')
      .sort({ date_time: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Appointment.countDocuments(filter),
  ]);

  res.json({ items, total, page, limit, pages: Math.ceil(total / limit) || 1 });
});

export const todayAppointments = asyncHandler(async (req, res) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const items = await Appointment.find({
    date_time: { $gte: start, $lt: end },
    status: APPOINTMENT_STATUS.SCHEDULED,
  })
    .populate('patient')
    .populate('doctor', 'fullName email')
    .sort({ date_time: 1 })
    .lean();

  res.json({ items });
});

export const createAppointment = asyncHandler(async (req, res) => {
  const { patient, doctor, date_time, notes } = req.body;
  const docUser = await User.findById(doctor);
  if (!docUser || docUser.role !== ROLES.DOCTOR) {
    return res.status(400).json({ message: 'Invalid doctor' });
  }
  const p = await Patient.findById(patient);
  if (!p) return res.status(400).json({ message: 'Invalid patient' });

  const appt = await Appointment.create({
    patient,
    doctor,
    date_time: new Date(date_time),
    notes: notes || '',
  });

  await createVisitWithPayment({
    patient,
    doctor,
    appointmentId: appt._id,
  });

  const populated = await Appointment.findById(appt._id)
    .populate('patient')
    .populate('doctor', 'fullName email');
  res.status(201).json(populated);
});

export const checkInAppointment = asyncHandler(async (req, res) => {
  const appt = await Appointment.findById(req.params.id);
  if (!appt) return res.status(404).json({ message: 'Appointment not found' });
  if (appt.status === APPOINTMENT_STATUS.CANCELLED) {
    return res.status(400).json({ message: 'Appointment was cancelled' });
  }

  let visit = await findVisitForAppointment(appt._id);
  if (!visit) {
    visit = await createVisitWithPayment({
      patient: appt.patient,
      doctor: appt.doctor,
      appointmentId: appt._id,
    });
  }

  if (appt.status === APPOINTMENT_STATUS.SCHEDULED) {
    appt.status = APPOINTMENT_STATUS.CHECKED_IN;
    await appt.save();
  }

  const full = await Visit.findById(visit._id)
    .populate('patient')
    .populate('doctor', 'fullName email visitFee')
    .populate('appointment');

  res.status(201).json({ visit: full, message: 'Patient checked in' });
});

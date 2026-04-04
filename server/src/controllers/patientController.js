import mongoose from 'mongoose';
import { Patient } from '../models/Patient.js';
import { Visit } from '../models/Visit.js';
import { LabOrder } from '../models/LabOrder.js';
import { Appointment } from '../models/Appointment.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Shared filter for list + admin-style reports: search (name or phone), gender, registration date range. */
function buildPatientListFilter(query) {
  const rawSearch = (query.search || query.patientSearch || '').trim();
  const gender = query.gender || query.patientGender;
  const registeredFrom = query.registeredFrom ? String(query.registeredFrom) : '';
  const registeredTo = query.registeredTo ? String(query.registeredTo) : '';

  const filter = {};
  if (gender && ['male', 'female'].includes(gender)) {
    filter.gender = gender;
  }
  if (rawSearch) {
    const esc = escapeRegex(rawSearch);
    filter.$or = [{ full_name: new RegExp(esc, 'i') }, { phone: new RegExp(esc, 'i') }];
  }
  if (registeredFrom || registeredTo) {
    const range = {};
    if (registeredFrom) {
      const d = new Date(registeredFrom);
      if (!Number.isNaN(d.getTime())) range.$gte = d;
    }
    if (registeredTo) {
      const d = new Date(registeredTo);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        range.$lte = d;
      }
    }
    if (Object.keys(range).length) filter.createdAt = range;
  }
  return filter;
}

export const listPatients = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  const filter = buildPatientListFilter(req.query);

  const [items, total] = await Promise.all([
    Patient.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('_id full_name phone gender dob createdAt')
      .lean(),
    Patient.countDocuments(filter),
  ]);

  res.json({ items, total, page, limit, pages: Math.ceil(total / limit) || 1 });
});

function normalizeGender(g) {
  const x = String(g || '').toLowerCase();
  return x === 'female' || x === 'male' ? x : null;
}

export const createPatient = asyncHandler(async (req, res) => {
  const { full_name, phone, gender, dob, address } = req.body;
  const g = normalizeGender(gender);
  if (!g) {
    return res.status(400).json({ message: 'Gender must be male or female' });
  }
  const patient = await Patient.create({
    full_name,
    phone,
    gender: g,
    dob: new Date(dob),
    address: typeof address === 'string' ? address.trim() : '',
  });
  res.status(201).json(patient);
});

export const getPatient = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  if (!patient) return res.status(404).json({ message: 'Patient not found' });
  res.json(patient);
});

export const updatePatient = asyncHandler(async (req, res) => {
  const { full_name, phone, gender, dob, address } = req.body;
  const g = normalizeGender(gender);
  if (gender !== undefined && !g) {
    return res.status(400).json({ message: 'Gender must be male or female' });
  }
  const updates = {
    full_name,
    phone,
    ...(gender !== undefined && g ? { gender: g } : {}),
    ...(dob && { dob: new Date(dob) }),
  };
  if (address !== undefined) {
    updates.address = typeof address === 'string' ? address.trim() : '';
  }
  const patient = await Patient.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!patient) return res.status(404).json({ message: 'Patient not found' });
  res.json(patient);
});

export const deletePatient = asyncHandler(async (req, res) => {
  const patient = await Patient.findByIdAndDelete(req.params.id);
  if (!patient) return res.status(404).json({ message: 'Patient not found' });
  res.json({ message: 'Patient removed' });
});

/** Full medical report for print page */
export const getPatientReport = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.id).lean();
  if (!patient) return res.status(404).json({ message: 'Patient not found' });

  const visitsRaw = await Visit.find({ patient: req.params.id })
    .populate('doctor', 'fullName email')
    .sort({ createdAt: -1 })
    .lean();

  const apptIds = visitsRaw.map((v) => v.appointment).filter((id) => id && mongoose.isValidObjectId(id));
  const appts = apptIds.length ? await Appointment.find({ _id: { $in: apptIds } }).lean() : [];
  const apptMap = Object.fromEntries(appts.map((a) => [String(a._id), a]));

  const visits = visitsRaw.map((v) => ({
    ...v,
    appointment: v.appointment && apptMap[String(v.appointment)] ? apptMap[String(v.appointment)] : null,
  }));

  const visitIds = visits.map((v) => v._id);
  const labOrders = await LabOrder.find({ visit: { $in: visitIds } })
    .populate('doctor', 'fullName')
    .populate({
      path: 'requested_tests.test',
      populate: { path: 'category', select: 'name sort_order' },
    })
    .sort({ createdAt: -1 })
    .lean();

  const labByVisit = {};
  for (const lo of labOrders) {
    const key = String(lo.visit);
    if (!labByVisit[key]) labByVisit[key] = [];
    labByVisit[key].push(lo);
  }

  res.json({
    patient,
    visits: visits.map((v) => ({
      ...v,
      prescription: v.prescription || v.diagnosis || '',
      lab_orders: labByVisit[String(v._id)] || [],
    })),
  });
});

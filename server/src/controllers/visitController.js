import mongoose from 'mongoose';
import { Visit } from '../models/Visit.js';
import { Payment } from '../models/Payment.js';
import { LabOrder } from '../models/LabOrder.js';
import { Appointment } from '../models/Appointment.js';
import { User } from '../models/User.js';
import { Patient } from '../models/Patient.js';
import { ROLES } from '../config/constants.js';
import { VISIT_STATUS, PAYMENT_STATUS } from '../config/constants.js';
import { LAB_ORDER_STATUS, LAB_PRIORITY } from '../config/constants.js';
import { nextLabRefNo } from '../services/labRef.js';
import { resolveRequestedTestsFromBody } from '../services/labRequestResolve.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { MEDICATION_PRESETS } from '../data/medicationPresets.js';
import { computeLabOrderFee, queueCashierCharge } from '../services/visitBilling.js';

export const getMedicationPresets = asyncHandler(async (req, res) => {
  res.json({ items: MEDICATION_PRESETS });
});

export const listVisits = asyncHandler(async (req, res) => {
  const {
    payment_status,
    visit_status,
    doctor,
    patient: patientId,
    page: pageQ,
    limit: limitQ,
  } = req.query;

  const filter = {};
  if (payment_status) filter.payment_status = payment_status;
  if (visit_status) filter.visit_status = visit_status;
  if (doctor) filter.doctor = doctor;
  if (patientId) filter.patient = patientId;

  const page = Math.max(1, parseInt(pageQ, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(limitQ, 10) || 20));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Visit.find(filter)
      .populate('patient')
      .populate('doctor', 'fullName email')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Visit.countDocuments(filter),
  ]);

  res.json({ items, total, page, limit, pages: Math.ceil(total / limit) || 1 });
});

/** Doctor: distinct patients seen by this doctor (any visit), with counts and last visit. Admin: pass ?doctor=<userId>. */
export const doctorMyPatients = asyncHandler(async (req, res) => {
  let doctorId = req.user._id;
  if (req.user.role === ROLES.ADMIN) {
    const q = req.query.doctor;
    if (!q || !mongoose.isValidObjectId(q)) {
      return res.status(400).json({ message: 'Query parameter "doctor" (doctor user id) is required.' });
    }
    doctorId = q;
  } else if (req.user.role !== ROLES.DOCTOR) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const visits = await Visit.find({ doctor: doctorId })
    .populate('patient', 'full_name phone gender dob')
    .lean();

  const map = new Map();
  for (const v of visits) {
    if (!v.patient) continue;
    const pid = String(v.patient._id);
    if (!map.has(pid)) {
      map.set(pid, {
        patient: v.patient,
        visit_count: 0,
        completed_count: 0,
        last_visit_at: null,
      });
    }
    const row = map.get(pid);
    row.visit_count += 1;
    if (v.visit_status === VISIT_STATUS.COMPLETED) row.completed_count += 1;
    const t = new Date(v.createdAt);
    if (!row.last_visit_at || t > new Date(row.last_visit_at)) row.last_visit_at = v.createdAt;
  }

  const items = Array.from(map.values()).sort(
    (a, b) => new Date(b.last_visit_at) - new Date(a.last_visit_at)
  );

  res.json({
    items: items.map((row) => ({
      patient: row.patient,
      visit_count: row.visit_count,
      completed_visit_count: row.completed_count,
      has_completed_visit: row.completed_count > 0,
      last_visit_at: row.last_visit_at,
    })),
  });
});

/** Doctor: paid visits that are not completed */
export const doctorQueue = asyncHandler(async (req, res) => {
  const doctorId = req.user.role === ROLES.DOCTOR ? req.user._id : req.query.doctor;
  const filter = {
    payment_status: PAYMENT_STATUS.PAID,
    visit_status: { $ne: VISIT_STATUS.COMPLETED },
  };
  if (req.user.role === ROLES.DOCTOR) {
    filter.doctor = req.user._id;
  } else if (doctorId) {
    filter.doctor = doctorId;
  }

  const items = await Visit.find(filter)
    .populate('patient')
    .populate('doctor', 'fullName email')
    .sort({ updatedAt: -1 })
    .lean();

  res.json({ items });
});

/** Doctor / admin: recently completed visits (reopen for corrections). */
export const doctorRecentCompleted = asyncHandler(async (req, res) => {
  const doctorId =
    req.user.role === ROLES.DOCTOR ? req.user._id : req.query.doctor ? String(req.query.doctor) : null;
  if (req.user.role === ROLES.ADMIN && !doctorId) {
    return res.status(400).json({ message: 'doctor query parameter required' });
  }
  if (!doctorId) {
    return res.status(400).json({ message: 'Invalid doctor' });
  }

  const items = await Visit.find({
    doctor: doctorId,
    payment_status: PAYMENT_STATUS.PAID,
    visit_status: VISIT_STATUS.COMPLETED,
  })
    .populate('patient')
    .populate('doctor', 'fullName email')
    .sort({ updatedAt: -1 })
    .limit(35)
    .lean();

  res.json({ items });
});

/** Same JSON shape as GET /visits/:id (for reopen, etc.). */
async function buildVisitDetailPayload(visitId) {
  const visit = await Visit.findById(visitId)
    .populate('patient')
    .populate('doctor', 'fullName email visitFee');
  if (!visit) return null;

  let appointment = null;
  if (visit.appointment && mongoose.isValidObjectId(visit.appointment)) {
    appointment = await Appointment.findById(visit.appointment).lean();
  }

  const visitPayload = visit.toObject();
  visitPayload.prescription = visitPayload.prescription || visitPayload.diagnosis || '';
  delete visitPayload.diagnosis;
  visitPayload.appointment = appointment;

  const [payment, labOrders] = await Promise.all([
    Payment.findOne({ visit: visit._id }).lean(),
    LabOrder.find({ visit: visit._id })
      .populate('doctor', 'fullName')
      .populate({
        path: 'requested_tests.test',
        populate: { path: 'category', select: 'name sort_order' },
      })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  return { visit: visitPayload, payment, lab_orders: labOrders };
}

export const getVisit = asyncHandler(async (req, res) => {
  const payload = await buildVisitDetailPayload(req.params.id);
  if (!payload) return res.status(404).json({ message: 'Visit not found' });
  res.json(payload);
});

/** Walk-in: create visit without appointment (reception) */
export const createWalkInVisit = asyncHandler(async (req, res) => {
  const { patient, doctor } = req.body;
  const docUser = await User.findById(doctor);
  if (!docUser || docUser.role !== ROLES.DOCTOR) {
    return res.status(400).json({ message: 'Invalid doctor' });
  }
  const p = await Patient.findById(patient);
  if (!p) return res.status(400).json({ message: 'Invalid patient' });

  const vf = docUser != null ? Number(docUser.visitFee) || 0 : 0;

  const visit = await Visit.create({
    patient,
    doctor,
    appointment: null,
    visit_status: VISIT_STATUS.SENT_TO_CASHIER,
    payment_status: PAYMENT_STATUS.UNPAID,
  });
  await Payment.create({
    visit: visit._id,
    amount: vf,
    status: PAYMENT_STATUS.UNPAID,
    charge_type: 'consultation',
  });

  const full = await Visit.findById(visit._id)
    .populate('patient')
    .populate('doctor', 'fullName email visitFee');

  res.status(201).json(full);
});

function normalizeMedicationLines(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue;
    const medication = typeof m.medication === 'string' ? m.medication.trim() : '';
    const dosage = typeof m.dosage === 'string' ? m.dosage.trim() : '';
    if (medication || dosage) out.push({ medication, dosage });
  }
  return out;
}

export const updateVisitDoctor = asyncHandler(async (req, res) => {
  const { prescription, doctor_notes, diagnosis, dosage, frequency, route, duration, medications } = req.body;
  const visit = await Visit.findById(req.params.id);
  if (!visit) return res.status(404).json({ message: 'Visit not found' });

  if (req.user.role === ROLES.DOCTOR && String(visit.doctor) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not your visit' });
  }
  if (visit.payment_status !== PAYMENT_STATUS.PAID) {
    const pay = await Payment.findOne({ visit: visit._id });
    const allowWhilePharmacyPending =
      visit.visit_status === VISIT_STATUS.SENT_TO_CASHIER &&
      pay &&
      pay.charge_type === 'pharmacy';
    if (!allowWhilePharmacyPending) {
      return res.status(400).json({ message: 'Payment required before clinical work' });
    }
  }
  if (visit.visit_status === VISIT_STATUS.COMPLETED) {
    return res.status(400).json({
      message: 'Visit is completed. Reopen the visit to change prescription or notes.',
    });
  }

  if (medications !== undefined) {
    const cleaned = normalizeMedicationLines(medications);
    if (cleaned !== null) {
      visit.medications = cleaned;
      visit.prescription = cleaned.map((x) => x.medication).filter(Boolean).join('\n');
      visit.dosage = cleaned.map((x) => x.dosage).filter(Boolean).join('\n');
      visit.diagnosis = '';
    }
  } else {
    const rx = prescription !== undefined ? prescription : diagnosis;
    if (rx !== undefined) {
      visit.prescription = typeof rx === 'string' ? rx : '';
      visit.diagnosis = '';
    }
    if (dosage !== undefined) visit.dosage = typeof dosage === 'string' ? dosage : '';
    if (rx !== undefined || dosage !== undefined) {
      const legacy = normalizeMedicationLines([
        { medication: visit.prescription || '', dosage: visit.dosage || '' },
      ]);
      visit.medications = legacy || [];
    }
  }

  if (frequency !== undefined) visit.frequency = typeof frequency === 'string' ? frequency : '';
  if (route !== undefined) visit.route = typeof route === 'string' ? route : '';
  if (duration !== undefined) visit.duration = typeof duration === 'string' ? duration : '';
  if (doctor_notes !== undefined) visit.doctor_notes = doctor_notes;
  await visit.save();

  const v = await Visit.findById(visit._id);
  if (v && v.payment_status === PAYMENT_STATUS.PAID && !v.pharmacy_charge_posted) {
    const meds = v.medications?.length
      ? v.medications
      : [{ medication: v.prescription || '', dosage: v.dosage || '' }];
    const hasMeds = meds.some(
      (m) =>
        (m.medication && String(m.medication).trim()) || (m.dosage && String(m.dosage).trim())
    );
    if (hasMeds) {
      await queueCashierCharge(v, { amount: 0, charge_type: 'pharmacy' });
      await Visit.updateOne({ _id: v._id }, { $set: { pharmacy_charge_posted: true } });
    }
  }

  const full = await Visit.findById(visit._id)
    .populate('patient')
    .populate('doctor', 'fullName email visitFee');
  res.json(full);
});

export const requestLab = asyncHandler(async (req, res) => {
  const { priority: priorityBody, notes } = req.body;
  const resolved = await resolveRequestedTestsFromBody(req.body);
  if (resolved.error) return res.status(400).json({ message: resolved.error });
  if (!resolved.requested_tests.length && !resolved.test_requests.length) {
    return res.status(400).json({ message: 'At least one test is required' });
  }

  const visit = await Visit.findById(req.params.id);
  if (!visit) return res.status(404).json({ message: 'Visit not found' });
  const isAssignedDoctor = String(visit.doctor) === String(req.user._id);
  const isAdmin = req.user.role === ROLES.ADMIN;
  if (!isAssignedDoctor && !isAdmin) {
    return res.status(403).json({ message: 'Not your visit' });
  }
  if (visit.payment_status !== PAYMENT_STATUS.PAID) {
    return res.status(400).json({ message: 'Payment required' });
  }
  if (
    visit.visit_status !== VISIT_STATUS.PENDING_DOCTOR &&
    visit.visit_status !== VISIT_STATUS.LAB_COMPLETED
  ) {
    return res.status(400).json({ message: 'Cannot request lab in current visit state' });
  }

  const pri = priorityBody === LAB_PRIORITY.URGENT ? LAB_PRIORITY.URGENT : LAB_PRIORITY.NORMAL;
  const labRef = await nextLabRefNo();

  const order = await LabOrder.create({
    visit: visit._id,
    patient: visit.patient,
    doctor: isAdmin ? visit.doctor : req.user._id,
    lab_ref_no: labRef,
    requested_tests: resolved.requested_tests,
    test_requests: resolved.test_requests,
    priority: pri,
    notes: typeof notes === 'string' ? notes : '',
    status: LAB_ORDER_STATUS.PENDING,
  });

  const labFee = await computeLabOrderFee(resolved.requested_tests, resolved.test_requests);
  await queueCashierCharge(visit, { amount: labFee, charge_type: 'lab' });

  const populated = await LabOrder.findById(order._id)
    .populate('patient')
    .populate('doctor', 'fullName')
    .populate('visit')
    .populate({
      path: 'requested_tests.test',
      populate: { path: 'category', select: 'name sort_order' },
    });

  res.status(201).json(populated);
});

export const completeVisit = asyncHandler(async (req, res) => {
  const visit = await Visit.findById(req.params.id);
  if (!visit) return res.status(404).json({ message: 'Visit not found' });
  const isAssignedDoctor = String(visit.doctor) === String(req.user._id);
  const isAdmin = req.user.role === ROLES.ADMIN;
  if (!isAssignedDoctor && !isAdmin) {
    return res.status(403).json({ message: 'Not your visit' });
  }
  if (visit.payment_status !== PAYMENT_STATUS.PAID) {
    return res.status(400).json({ message: 'Payment required' });
  }

  const allowed = [VISIT_STATUS.PENDING_DOCTOR, VISIT_STATUS.LAB_COMPLETED];
  if (!allowed.includes(visit.visit_status)) {
    return res.status(400).json({
      message: 'Complete lab work first if lab was requested',
    });
  }

  visit.visit_status = VISIT_STATUS.COMPLETED;
  await visit.save();

  const full = await Visit.findById(visit._id)
    .populate('patient')
    .populate('doctor', 'fullName email');
  res.json(full);
});

/**
 * Undo completion so the assigned doctor can correct prescription, notes, or lab workflow.
 * Picks a safe prior status from existing lab orders.
 */
export const reopenVisit = asyncHandler(async (req, res) => {
  const visit = await Visit.findById(req.params.id);
  if (!visit) return res.status(404).json({ message: 'Visit not found' });

  const isAssignedDoctor = String(visit.doctor) === String(req.user._id);
  const isAdmin = req.user.role === ROLES.ADMIN;
  if (!isAssignedDoctor && !isAdmin) {
    return res.status(403).json({ message: 'Not your visit' });
  }
  if (visit.payment_status !== PAYMENT_STATUS.PAID) {
    return res.status(400).json({ message: 'Payment required' });
  }
  if (visit.visit_status !== VISIT_STATUS.COMPLETED) {
    return res.status(400).json({ message: 'Only completed visits can be reopened' });
  }

  const orders = await LabOrder.find({ visit: visit._id }).select('status').lean();
  let next = VISIT_STATUS.PENDING_DOCTOR;
  if (orders.some((o) => o.status === LAB_ORDER_STATUS.PENDING || o.status === LAB_ORDER_STATUS.IN_PROGRESS)) {
    next = VISIT_STATUS.LAB_REQUESTED;
  } else if (orders.length > 0) {
    next = VISIT_STATUS.LAB_COMPLETED;
  }

  visit.visit_status = next;
  await visit.save();

  const payload = await buildVisitDetailPayload(visit._id);
  if (!payload) return res.status(500).json({ message: 'Could not load visit' });
  res.json(payload);
});

import mongoose from 'mongoose';
import { LabOrder } from '../models/LabOrder.js';
import { LabTest } from '../models/LabTest.js';
import { TestCategory } from '../models/TestCategory.js';
import { Visit } from '../models/Visit.js';
import {
  VISIT_STATUS,
  LAB_ORDER_STATUS,
  LAB_PRIORITY,
  PAYMENT_STATUS,
  ROLES,
} from '../config/constants.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { nextLabRefNo } from '../services/labRef.js';
import { resolveRequestedTestsFromBody } from '../services/labRequestResolve.js';
import { computeLabOrderFee, queueCashierCharge } from '../services/visitBilling.js';

const populateLabOrder = [
  { path: 'patient' },
  { path: 'doctor', select: 'fullName email' },
  { path: 'visit' },
  { path: 'requested_tests.test', populate: { path: 'category', select: 'name sort_order' } },
];

function validateResults(results) {
  if (!Array.isArray(results)) return 'results must be an array';
  for (const item of results) {
    if (!item || typeof item !== 'object') return 'Invalid result entry';
    if (item.type === 'numeric') {
      if (!item.parameter || typeof item.value !== 'number' || Number.isNaN(item.value)) {
        return 'Numeric results need parameter and numeric value';
      }
    } else if (item.type === 'text') {
      if (!item.test_name || item.result === undefined || item.result === null) {
        return 'Text results need test_name and result';
      }
    } else if (item.type === 'imaging') {
      if (!item.test_name || item.report === undefined || item.report === null) {
        return 'Imaging results need test_name and report';
      }
    } else {
      return 'Each result needs type "numeric", "text", or "imaging"';
    }
  }
  return null;
}

async function enrichResultsWithCatalog(results) {
  const out = [];
  for (const r of results) {
    const row = { ...r };
    const tid = row.test;
    if (tid && mongoose.isValidObjectId(tid)) {
      const lt = await LabTest.findById(tid).populate('category', 'name').lean();
      if (lt?.category) {
        row.category = lt.category._id;
        row.category_name = lt.category.name;
      }
    }
    out.push(row);
  }
  return out;
}

export const getLabCatalog = asyncHandler(async (req, res) => {
  const categories = await TestCategory.find().sort({ sort_order: 1, name: 1 }).lean();
  const tests = await LabTest.find().sort({ name: 1 }).lean();
  const byCatId = Object.fromEntries(categories.map((c) => [String(c._id), { ...c, tests: [] }]));
  for (const t of tests) {
    const k = String(t.category);
    if (byCatId[k]) byCatId[k].tests.push(t);
  }
  res.json({ categories: Object.values(byCatId) });
});

export const listLabOrders = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (req.user.role === ROLES.DOCTOR) {
    filter.doctor = req.user._id;
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const skip = (page - 1) * limit;

  if (req.user.role === ROLES.LAB) {
    const paidVisitIds = await Visit.find({ payment_status: PAYMENT_STATUS.PAID }).distinct('_id');
    filter.visit = { $in: paidVisitIds };
  }

  const [items, total] = await Promise.all([
    LabOrder.find(filter)
      .populate(populateLabOrder)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    LabOrder.countDocuments(filter),
  ]);

  res.json({ items, total, page, limit, pages: Math.ceil(total / limit) || 1 });
});

export const eligibleVisitsForLab = asyncHandler(async (req, res) => {
  const filter = {
    payment_status: PAYMENT_STATUS.PAID,
    visit_status: { $in: [VISIT_STATUS.PENDING_DOCTOR, VISIT_STATUS.LAB_COMPLETED] },
  };
  if (req.user.role === ROLES.DOCTOR) {
    filter.doctor = req.user._id;
  }
  const visits = await Visit.find(filter)
    .populate('patient', 'full_name phone gender dob')
    .populate('doctor', 'fullName email')
    .sort({ updatedAt: -1 })
    .limit(150)
    .lean();
  res.json({ items: visits });
});

export const createLabOrder = asyncHandler(async (req, res) => {
  const { visitId, priority, notes } = req.body;
  if (!visitId) return res.status(400).json({ message: 'visitId required' });

  const resolved = await resolveRequestedTestsFromBody(req.body);
  if (resolved.error) return res.status(400).json({ message: resolved.error });
  const { requested_tests, test_requests } = resolved;
  if (!requested_tests.length && !test_requests.length) {
    return res.status(400).json({ message: 'At least one test is required' });
  }

  const visit = await Visit.findById(visitId);
  if (!visit) return res.status(404).json({ message: 'Visit not found' });
  if (req.user.role === ROLES.DOCTOR && String(visit.doctor) !== String(req.user._id)) {
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

  const pri = priority === LAB_PRIORITY.URGENT ? LAB_PRIORITY.URGENT : LAB_PRIORITY.NORMAL;
  const labRef = await nextLabRefNo();

  const order = await LabOrder.create({
    visit: visit._id,
    patient: visit.patient,
    doctor: visit.doctor,
    lab_ref_no: labRef,
    requested_tests,
    test_requests,
    priority: pri,
    notes: typeof notes === 'string' ? notes : '',
    status: LAB_ORDER_STATUS.PENDING,
  });

  const labFee = await computeLabOrderFee(requested_tests, test_requests);
  await queueCashierCharge(visit, { amount: labFee, charge_type: 'lab' });

  const populated = await LabOrder.findById(order._id).populate(populateLabOrder);
  res.status(201).json(populated);
});

function ageFromDob(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  const t = new Date();
  let age = t.getFullYear() - d.getFullYear();
  const md = t.getMonth() - d.getMonth();
  if (md < 0 || (md === 0 && t.getDate() < d.getDate())) age -= 1;
  return age;
}

function mapResultsForReport(results) {
  return (results || []).map((r) => {
    const category_name = r.category_name != null ? String(r.category_name) : '';
    if (r.type === 'numeric') {
      return {
        kind: 'numeric',
        category_name,
        test_name: r.parameter,
        result: String(r.value),
        n_range: r.normal_range != null && r.normal_range !== '' ? String(r.normal_range) : '—',
        uom: r.unit != null && r.unit !== '' ? String(r.unit) : '—',
        image_url: '',
      };
    }
    if (r.type === 'imaging') {
      return {
        kind: 'imaging',
        category_name,
        test_name: r.test_name,
        result: String(r.report ?? ''),
        n_range: '—',
        uom: '—',
        image_url: r.image_url != null && r.image_url !== '' ? String(r.image_url) : '',
      };
    }
    return {
      kind: 'text',
      category_name,
      test_name: r.test_name,
      result: String(r.result ?? ''),
      n_range: '—',
      uom: '—',
      image_url: '',
    };
  });
}

function pendingRowsFromOrder(order) {
  const rt = order.requested_tests || [];
  if (rt.length) {
    return rt.map((line) => {
      const t = line.test;
      const name = t && typeof t === 'object' && t.name ? t.name : 'Test';
      const cat = t?.category?.name ? String(t.category.name) : '';
      return {
        kind: 'pending',
        category_name: cat,
        test_name: name,
        result: 'Pending',
        n_range: t?.normal_range ? String(t.normal_range) : '—',
        uom: t?.unit ? String(t.unit) : '—',
        image_url: '',
      };
    });
  }
  return (order.test_requests || []).map((name) => ({
    kind: 'pending',
    category_name: '',
    test_name: name,
    result: 'Pending',
    n_range: '—',
    uom: '—',
    image_url: '',
  }));
}

export const getLabReport = asyncHandler(async (req, res) => {
  const order = await LabOrder.findById(req.params.id)
    .populate('patient')
    .populate('doctor', 'fullName email')
    .populate('visit')
    .populate({ path: 'requested_tests.test', populate: { path: 'category', select: 'name' } });
  if (!order) return res.status(404).json({ message: 'Lab order not found' });

  const p = order.patient;
  const stamp = order.status === LAB_ORDER_STATUS.COMPLETED && order.updatedAt ? order.updatedAt : order.createdAt;
  const reportDate = new Date(stamp || Date.now());

  const rows =
    order.status === LAB_ORDER_STATUS.COMPLETED
      ? mapResultsForReport(order.results)
      : pendingRowsFromOrder(order);

  const fallbackRef = parseInt(String(order._id).slice(-8), 16) % 900000 + 10000;

  res.json({
    department_title: 'Department of Laboratory Medicine',
    lab_ref_no: order.lab_ref_no ?? fallbackRef,
    patient_name: p?.full_name ?? '—',
    patient_id: p?._id ? `PID-${String(p._id).slice(-6).toUpperCase()}` : '—',
    age: ageFromDob(p?.dob),
    sex: p?.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : '—',
    tel: p?.phone ?? '—',
    report_date: reportDate.toISOString().slice(0, 10),
    report_time: reportDate.toTimeString().slice(0, 8),
    doctor_name: order.doctor?.fullName ?? '—',
    test_requests: order.test_requests,
    priority: order.priority,
    notes: order.notes,
    status: order.status,
    rows,
  });
});

export const getLabOrder = asyncHandler(async (req, res) => {
  const order = await LabOrder.findById(req.params.id).populate(populateLabOrder);
  if (!order) return res.status(404).json({ message: 'Lab order not found' });
  res.json(order);
});

export const submitLabResults = asyncHandler(async (req, res) => {
  const { results } = req.body;
  const err = validateResults(results || []);
  if (err) return res.status(400).json({ message: err });

  const order = await LabOrder.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Lab order not found' });
  if (order.status === LAB_ORDER_STATUS.COMPLETED) {
    return res.status(400).json({ message: 'Order already completed' });
  }

  const visitForLab = await Visit.findById(order.visit);
  if (!visitForLab || visitForLab.payment_status !== PAYMENT_STATUS.PAID) {
    return res.status(403).json({ message: 'Lab fee must be paid before results can be entered' });
  }

  const enriched = await enrichResultsWithCatalog(results || []);
  order.results = enriched;
  order.status = LAB_ORDER_STATUS.COMPLETED;
  await order.save();

  const visit = await Visit.findById(order.visit);
  if (visit && visit.visit_status === VISIT_STATUS.LAB_REQUESTED) {
    visit.visit_status = VISIT_STATUS.LAB_COMPLETED;
    await visit.save();
  }

  const populated = await LabOrder.findById(order._id).populate(populateLabOrder);
  res.json(populated);
});

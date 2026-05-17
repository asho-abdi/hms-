import { LabOrder } from '../models/LabOrder.js';
import { LabTest } from '../models/LabTest.js';
import { LabResult } from '../models/LabResult.js';
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
  {
    path: 'requested_tests.test',
    populate: [
      { path: 'category', select: 'name sort_order' },
      { path: 'child_tests', select: 'name result_type unit normal_range normal_ranges expected_value category' },
    ],
  },
];

function resolveTestResultType(test) {
  if (!test) return 'number';
  if (test.result_type) return test.result_type;
  if (test.type === 'numeric') return 'number';
  if (test.type === 'text') return 'text';
  if (test.type === 'imaging') return 'imaging';
  return 'number';
}

function deriveRangeText(range) {
  if (!range) return '';
  if (range.text) return String(range.text);
  const hasMin = typeof range.min === 'number';
  const hasMax = typeof range.max === 'number';
  if (hasMin && hasMax) return `${range.min}-${range.max}`;
  if (hasMin) return `>=${range.min}`;
  if (hasMax) return `<=${range.max}`;
  return '';
}

function pickRange(ranges, patientGender) {
  if (!Array.isArray(ranges) || !ranges.length) return null;
  const g = String(patientGender || '').toUpperCase();
  const preferred = ranges.find((r) => {
    if (!r || typeof r !== 'object') return false;
    const rg = String(r.gender || 'ANY').toUpperCase();
    if (rg === 'ANY') return false;
    if (g.startsWith('M') && rg === 'MALE') return true;
    if (g.startsWith('F') && rg === 'FEMALE') return true;
    return false;
  });
  return preferred || ranges.find((r) => String(r?.gender || 'ANY').toUpperCase() === 'ANY') || ranges[0];
}

function computeFlagForNumber(num, range) {
  if (!range || typeof num !== 'number' || Number.isNaN(num)) return 'UNSET';
  if (typeof range.min === 'number' && num < range.min) return 'LOW';
  if (typeof range.max === 'number' && num > range.max) return 'HIGH';
  return 'NORMAL';
}

function computeFlagForValue({ resultType, valueText, valueBool, expected }) {
  const exp = String(expected || '').trim();
  if (!exp) return 'UNSET';
  if (resultType === 'boolean') {
    if (valueBool === null || valueBool === undefined) return 'UNSET';
    const expectedBool = exp.toLowerCase() === 'true' || exp.toLowerCase() === 'positive';
    return valueBool === expectedBool ? 'NORMAL' : 'ABNORMAL';
  }
  if (resultType === 'text') {
    const actual = String(valueText || '').trim().toLowerCase();
    if (!actual) return 'UNSET';
    return actual === exp.toLowerCase() ? 'NORMAL' : 'ABNORMAL';
  }
  return 'UNSET';
}

function compactResultForOrder(lr) {
  if (lr.result_type === 'number') {
    return {
      type: 'numeric',
      result_type: 'number',
      test: lr.test,
      parameter: lr.test_name,
      value: lr.value_number,
      unit: lr.unit || '',
      normal_range: lr.normal_range || '',
      flag: lr.flag,
      category_name: lr.category_name || '',
    };
  }
  if (lr.result_type === 'panel') {
    return {
      type: 'panel',
      result_type: 'panel',
      test: lr.test,
      test_name: lr.test_name,
      panel_values: lr.panel_values || [],
      category_name: lr.category_name || '',
    };
  }
  if (lr.result_type === 'boolean') {
    return {
      type: 'boolean',
      result_type: 'boolean',
      test: lr.test,
      test_name: lr.test_name,
      result: lr.value_boolean === null ? '' : lr.value_boolean ? 'Positive' : 'Negative',
      flag: lr.flag,
      category_name: lr.category_name || '',
    };
  }
  if (lr.result_type === 'imaging') {
    return {
      type: 'imaging',
      result_type: 'imaging',
      test: lr.test,
      test_name: lr.test_name,
      report: lr.value_text || '',
      image_url: '',
      category_name: lr.category_name || '',
    };
  }
  return {
    type: 'text',
    result_type: 'text',
    test: lr.test,
    test_name: lr.test_name,
    result: lr.value_text || '',
    flag: lr.flag,
    category_name: lr.category_name || '',
  };
}

function validateResults(results) {
  if (!Array.isArray(results)) return 'results must be an array';
  for (const item of results) {
    if (!item || typeof item !== 'object') return 'Invalid result entry';
    const t = item.result_type || item.type;
    if (t === 'number' || t === 'numeric') {
      if (!item.test) return 'Numeric results must include test id';
      const n =
        typeof item.value_number === 'number'
          ? item.value_number
          : typeof item.value === 'number'
            ? item.value
            : Number(item.value);
      if (Number.isNaN(n)) return 'Numeric results need numeric value';
    } else if (t === 'text') {
      if (!item.test) return 'Text results must include test id';
      if (item.value_text === undefined && item.result === undefined) return 'Text results need value';
    } else if (t === 'boolean') {
      if (!item.test) return 'Boolean results must include test id';
      const vb = item.value_boolean;
      if (!(vb === true || vb === false || item.result === 'Positive' || item.result === 'Negative')) {
        return 'Boolean results need true/false (or Positive/Negative)';
      }
    } else if (t === 'panel') {
      if (!item.test) return 'Panel results must include test id';
      if (!Array.isArray(item.sub_results) || item.sub_results.length === 0) {
        return 'Panel results need sub_results';
      }
      for (const s of item.sub_results) {
        if (!s?.test) return 'Each panel sub-result must include child test id';
        const st = s.result_type || 'number';
        if (st === 'number') {
          const raw = s.value_number;
          const n = typeof raw === 'number' ? raw : String(raw ?? '').trim() === '' ? NaN : Number(raw);
          if (Number.isNaN(n)) return `Panel sub-result "${s.name || s.key || ''}" needs numeric value`;
        }
      }
    } else if (t === 'imaging') {
      if (!item.test) return 'Imaging results must include test id';
      if (!item.test_name) return 'Imaging results need test_name';
      if (item.report === undefined && item.value_text === undefined) return 'Imaging results need report text';
    } else {
      return 'Each result needs result_type number/text/boolean/panel';
    }
  }
  return null;
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
  const paidVisitIds = await Visit.find({ payment_status: PAYMENT_STATUS.PAID }).distinct('_id');
  const filter = { visit: { $in: paidVisitIds } };
  if (status) filter.status = status;
  if (req.user.role === ROLES.DOCTOR) {
    filter.doctor = req.user._id;
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const skip = (page - 1) * limit;

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
    visit_status: {
      $in: [VISIT_STATUS.PENDING_DOCTOR, VISIT_STATUS.LAB_REQUESTED, VISIT_STATUS.LAB_COMPLETED],
    },
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
    visit.visit_status !== VISIT_STATUS.LAB_REQUESTED &&
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
  const out = [];
  for (const r of results || []) {
    const category_name = r.category_name != null ? String(r.category_name) : '';
    const t = r.result_type || r.type;
    if (t === 'number' || t === 'numeric') {
      out.push({
        kind: 'numeric',
        category_name,
        test_name: r.panel_parent_name ? `${r.panel_parent_name} — ${r.parameter || r.test_name}` : r.parameter || r.test_name,
        result: String(r.value_number ?? r.value ?? ''),
        n_range: r.normal_range != null && r.normal_range !== '' ? String(r.normal_range) : '—',
        uom: r.unit != null && r.unit !== '' ? String(r.unit) : '—',
        image_url: '',
        flag: r.flag || 'UNSET',
      });
      continue;
    }
    if (t === 'boolean') {
      out.push({
        kind: 'text',
        category_name,
        test_name: r.panel_parent_name ? `${r.panel_parent_name} — ${r.test_name}` : r.test_name,
        result:
          r.value_boolean === true ? 'Positive' : r.value_boolean === false ? 'Negative' : String(r.result ?? ''),
        n_range: r.normal_range != null && r.normal_range !== '' ? String(r.normal_range) : '—',
        uom: r.unit != null && r.unit !== '' ? String(r.unit) : '—',
        image_url: '',
        flag: r.flag || 'UNSET',
      });
      continue;
    }
    if (t === 'panel') {
      for (const s of r.panel_values || []) {
        const subValue =
          s.result_type === 'number'
            ? s.value_number
            : s.result_type === 'boolean'
              ? s.value_boolean === true
                ? 'Positive'
                : s.value_boolean === false
                  ? 'Negative'
                  : ''
              : s.value_text;
        out.push({
          kind: s.result_type === 'number' ? 'numeric' : 'text',
          category_name,
          test_name: `${r.panel_parent_name || r.test_name || 'Panel'} — ${s.name}`,
          result: String(subValue ?? ''),
          n_range: s.normal_range != null && s.normal_range !== '' ? String(s.normal_range) : '—',
          uom: s.unit != null && s.unit !== '' ? String(s.unit) : '—',
          image_url: '',
          flag: s.flag || 'UNSET',
        });
      }
      continue;
    }
    if (t === 'imaging') {
      out.push({
        kind: 'imaging',
        category_name,
        test_name: r.panel_parent_name ? `${r.panel_parent_name} — ${r.test_name}` : r.test_name,
        result: String(r.report ?? r.value_text ?? ''),
        n_range: '—',
        uom: '—',
        image_url: r.image_url != null && r.image_url !== '' ? String(r.image_url) : '',
      });
      continue;
    }
    out.push({
      kind: 'text',
      category_name,
        test_name: r.panel_parent_name ? `${r.panel_parent_name} — ${r.test_name}` : r.test_name,
      result: String(r.value_text ?? r.result ?? ''),
      n_range: r.normal_range != null && r.normal_range !== '' ? String(r.normal_range) : '—',
      uom: r.unit != null && r.unit !== '' ? String(r.unit) : '—',
      image_url: '',
      flag: r.flag || 'UNSET',
    });
  }
  return out;
}

function pendingRowsFromOrder(order) {
  const rt = order.requested_tests || [];
  if (rt.length) {
    const rows = [];
    for (const line of rt) {
      const t = line.test;
      const name = t && typeof t === 'object' && t.name ? t.name : 'Test';
      const cat = t?.category?.name ? String(t.category.name) : '';
      const resultType = resolveTestResultType(t);
      if (resultType === 'panel') {
        const childRows =
          Array.isArray(t?.child_tests) && t.child_tests.length
            ? t.child_tests.map((c) => ({
                name: c.name,
                unit: c.unit || '',
                range:
                  deriveRangeText(pickRange(c.normal_ranges || [], order.patient?.gender)) ||
                  c.normal_range ||
                  '',
              }))
            : (t?.panel_subtests || []).map((s) => ({
                name: s.name,
                unit: s.unit || '',
                range: deriveRangeText(pickRange(s.normal_ranges || [], order.patient?.gender)) || '',
              }));
        for (const s of childRows) {
          rows.push({
            kind: 'pending',
            category_name: cat,
            test_name: `${name} — ${s.name}`,
            result: 'Pending',
            n_range: s.range || '—',
            uom: s.unit ? String(s.unit) : '—',
            image_url: '',
          });
        }
        continue;
      }
      rows.push({
        kind: 'pending',
        category_name: cat,
        test_name: name,
        result: 'Pending',
        n_range:
          deriveRangeText(pickRange(t?.normal_ranges || [], order.patient?.gender)) ||
          (t?.normal_range ? String(t.normal_range) : '—'),
        uom: t?.unit ? String(t.unit) : '—',
        image_url: '',
      });
    }
    return rows;
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
  if (order.visit?.payment_status !== PAYMENT_STATUS.PAID) {
    return res.status(403).json({ message: 'Lab details are hidden until payment is completed' });
  }

  const p = order.patient;
  const stamp = order.status === LAB_ORDER_STATUS.COMPLETED && order.updatedAt ? order.updatedAt : order.createdAt;
  const reportDate = new Date(stamp || Date.now());

  let rows = pendingRowsFromOrder(order);
  if (order.status === LAB_ORDER_STATUS.COMPLETED) {
    const persisted = await LabResult.find({ order: order._id }).lean();
    rows = mapResultsForReport(persisted.length ? persisted : order.results);
  }

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
  if (order.visit?.payment_status !== PAYMENT_STATUS.PAID) {
    return res.status(403).json({ message: 'Lab details are hidden until payment is completed' });
  }
  const rows = await LabResult.find({ order: order._id }).sort({ createdAt: 1 }).lean();
  const payload = order.toObject ? order.toObject() : order;
  payload.result_rows = rows;
  if ((!payload.results || !payload.results.length) && rows.length > 0) {
    payload.results = rows.map(compactResultForOrder);
  }
  res.json(payload);
});

export const startLabOrder = asyncHandler(async (req, res) => {
  const order = await LabOrder.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Lab order not found' });
  if (order.status === LAB_ORDER_STATUS.PENDING) {
    order.status = LAB_ORDER_STATUS.IN_PROGRESS;
    await order.save();
  }
  const full = await LabOrder.findById(order._id).populate(populateLabOrder);
  res.json(full);
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
  const patient = await Visit.findById(order.visit).populate('patient', 'gender').lean();
  const patientGender = patient?.patient?.gender || '';
  const requestedIds = (order.requested_tests || []).map((r) => String(r.test));
  const testDocs = requestedIds.length
    ? await LabTest.find({ _id: { $in: requestedIds } })
        .populate('category', 'name')
        .populate({ path: 'child_tests', populate: { path: 'category', select: 'name' } })
        .lean()
    : [];
  const testById = new Map(testDocs.map((t) => [String(t._id), t]));
  const childById = new Map();
  for (const t of testDocs) {
    for (const c of t.child_tests || []) {
      childById.set(String(c._id), c);
    }
  }

  const normalizedRows = [];
  for (const raw of results || []) {
    const tId = raw.test ? String(raw.test) : '';
    const testDef = tId ? testById.get(tId) : null;
    const resultType = raw.result_type || resolveTestResultType(testDef) || raw.type || 'text';
    const category = testDef?.category?._id || null;
    const category_name = testDef?.category?.name || raw.category_name || '';
    const test_name = testDef?.name || raw.parameter || raw.test_name || 'Test';

    if (resultType === 'panel') {
      const panelParentId = tId || null;
      const panelParentName = test_name;
      const subDefs = Array.isArray(testDef?.child_tests) ? testDef.child_tests : [];
      const byKey = new Map(subDefs.map((s) => [String(s.name || '').toLowerCase(), s]));
      const subRaw = Array.isArray(raw.sub_results) ? raw.sub_results : [];
      for (const s of subRaw) {
        const child =
          (s.test ? childById.get(String(s.test)) : null) ||
          byKey.get(String(s.name || '').toLowerCase()) ||
          null;
        const childTestId = child?._id || (s.test ? s.test : null);
        if (!childTestId) {
          continue;
        }
        const subType = s.result_type || child?.result_type || 'number';
        const subName = child?.name || s.name || 'Sub-test';
        const subRange = pickRange(child?.normal_ranges || [], patientGender);
        const subRangeText = s.normal_range || deriveRangeText(subRange) || '';
        const unit = s.unit || child?.unit || '';
        let value_number = null;
        let value_text = '';
        let value_boolean = null;
        let flag = 'UNSET';
        if (subType === 'number') {
          const rawNum = s.value_number;
          const n =
            typeof rawNum === 'number'
              ? rawNum
              : String(rawNum ?? '').trim() === ''
                ? NaN
                : Number(rawNum);
          value_number = Number.isNaN(n) ? null : n;
          flag = computeFlagForNumber(value_number, subRange);
        } else if (subType === 'boolean') {
          value_boolean =
            s.value_boolean === true || s.value_boolean === false
              ? s.value_boolean
              : String(s.value_text || '').toLowerCase() === 'positive';
          flag = computeFlagForValue({ resultType: 'boolean', valueBool: value_boolean, expected: child?.expected_value || subRange?.text || '' });
        } else {
          value_text = String(s.value_text ?? '').trim();
          flag = computeFlagForValue({
            resultType: 'text',
            valueText: value_text,
            expected: child?.expected_value || subRange?.text || '',
          });
        }
        normalizedRows.push({
          order: order._id,
          visit: order.visit,
          patient: order.patient,
          doctor: order.doctor,
          test: childTestId,
          test_name: subName,
          panel_parent_test: panelParentId,
          panel_parent_name: panelParentName,
          category: child?.category?._id || category,
          category_name: child?.category?.name || category_name,
          result_type: subType,
          value_number,
          value_text,
          value_boolean,
          unit,
          normal_range: subRangeText,
          flag,
          panel_values: [],
        });
      }
      continue;
    }

    const range = pickRange(testDef?.normal_ranges || [], patientGender);
    const rangeText = raw.normal_range || deriveRangeText(range) || testDef?.normal_range || '';
    const unit = raw.unit || testDef?.unit || '';
    let value_number = null;
    let value_text = '';
    let value_boolean = null;
    let flag = 'UNSET';

    if (resultType === 'number' || resultType === 'numeric') {
      const n =
        typeof raw.value_number === 'number'
          ? raw.value_number
          : typeof raw.value === 'number'
            ? raw.value
            : Number(raw.value);
      value_number = Number.isNaN(n) ? null : n;
      flag = computeFlagForNumber(value_number, range);
    } else if (resultType === 'boolean') {
      if (raw.value_boolean === true || raw.value_boolean === false) value_boolean = raw.value_boolean;
      else value_boolean = String(raw.result || '').toLowerCase() === 'positive';
      flag = computeFlagForValue({
        resultType: 'boolean',
        valueBool: value_boolean,
        expected: testDef?.expected_value || range?.text || '',
      });
    } else if (resultType === 'imaging') {
      value_text = String(raw.report ?? raw.value_text ?? '').trim();
    } else {
      value_text = String(raw.value_text ?? raw.result ?? '').trim();
      flag = computeFlagForValue({
        resultType: 'text',
        valueText: value_text,
        expected: testDef?.expected_value || range?.text || '',
      });
    }

    normalizedRows.push({
      order: order._id,
      visit: order.visit,
      patient: order.patient,
      doctor: order.doctor,
      test: tId || null,
      test_name,
      category,
      category_name,
      result_type: resultType === 'numeric' ? 'number' : resultType,
      value_number,
      value_text,
      value_boolean,
      unit,
      normal_range: rangeText,
      flag,
      panel_values: [],
    });
  }

  await LabResult.deleteMany({ order: order._id });
  if (normalizedRows.length > 0) {
    await LabResult.insertMany(normalizedRows, { ordered: true });
  }
  const savedRows = await LabResult.find({ order: order._id }).lean();
  order.results = savedRows.map(compactResultForOrder);
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

import { Payment } from '../models/Payment.js';
import { Visit } from '../models/Visit.js';
import { VISIT_STATUS, PAYMENT_STATUS } from '../config/constants.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listUnpaid = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ status: PAYMENT_STATUS.UNPAID })
    .populate({
      path: 'visit',
      populate: [
        { path: 'patient' },
        { path: 'doctor', select: 'fullName email visitFee' },
      ],
    })
    .sort({ createdAt: -1 })
    .lean();

  const items = payments.filter((p) => p.visit);
  res.json({ items });
});

/** Paginated list of all visit payments for reporting (paid / unpaid / all). */
export const listPaymentReport = asyncHandler(async (req, res) => {
  const rawStatus = (req.query.status || 'all').toLowerCase();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const skip = (page - 1) * limit;

  const filter = {};
  if (rawStatus === 'paid') filter.status = PAYMENT_STATUS.PAID;
  else if (rawStatus === 'unpaid') filter.status = PAYMENT_STATUS.UNPAID;

  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .populate({
        path: 'visit',
        populate: [
          { path: 'patient' },
          { path: 'doctor', select: 'fullName email visitFee' },
        ],
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments(filter),
  ]);

  const items = payments.filter((p) => p.visit);
  res.json({
    items,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1,
  });
});

export const payVisit = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  const num = Number(amount);
  if (Number.isNaN(num) || num < 0) {
    return res.status(400).json({ message: 'Valid amount required' });
  }

  const payment = await Payment.findOne({ visit: req.params.visitId });
  if (!payment) return res.status(404).json({ message: 'Payment not found' });
  if (payment.status === PAYMENT_STATUS.PAID) {
    return res.status(400).json({ message: 'Already paid' });
  }

  const chargeType = payment.charge_type || 'consultation';
  if (chargeType === 'pharmacy' && num <= 0) {
    return res.status(400).json({ message: 'Enter the amount to collect for pharmacy' });
  }

  const visit = await Visit.findById(req.params.visitId);
  if (!visit) return res.status(404).json({ message: 'Visit not found' });

  payment.amount = num;
  payment.status = PAYMENT_STATUS.PAID;
  payment.paid_at = new Date();

  visit.payment_status = PAYMENT_STATUS.PAID;

  if (chargeType === 'lab') {
    visit.visit_status = VISIT_STATUS.LAB_REQUESTED;
  } else if (chargeType === 'pharmacy') {
    const prev = visit.status_before_cashier;
    visit.visit_status =
      prev && Object.values(VISIT_STATUS).includes(prev) ? prev : VISIT_STATUS.PENDING_DOCTOR;
  } else {
    visit.visit_status = VISIT_STATUS.PENDING_DOCTOR;
  }
  visit.status_before_cashier = null;
  payment.charge_type = 'consultation';

  await payment.save();
  await visit.save();

  const fullPayment = await Payment.findById(payment._id)
    .populate({
      path: 'visit',
      populate: [
        { path: 'patient' },
        { path: 'doctor', select: 'fullName email visitFee' },
      ],
    });

  res.json({ payment: fullPayment, visit });
});

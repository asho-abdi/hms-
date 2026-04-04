import mongoose from 'mongoose';
import { LabTest } from '../models/LabTest.js';
import { Payment } from '../models/Payment.js';
import { VISIT_STATUS, PAYMENT_STATUS } from '../config/constants.js';

export const DEFAULT_LAB_TEST_PRICE = 10;

/**
 * Sum catalog test prices (plus a flat amount per legacy free-text test line).
 */
export async function computeLabOrderFee(requested_tests, test_requests) {
  let total = 0;
  for (const line of requested_tests || []) {
    const tid = line.test;
    if (mongoose.isValidObjectId(tid)) {
      const t = await LabTest.findById(tid).select('price').lean();
      const p = t != null ? Number(t.price) : NaN;
      if (!Number.isNaN(p) && p >= 0) {
        total += p;
      } else {
        total += DEFAULT_LAB_TEST_PRICE;
      }
    }
  }
  const legacyCount = (test_requests || []).filter((x) => String(x).trim()).length;
  total += legacyCount * DEFAULT_LAB_TEST_PRICE;
  return Math.round(total * 100) / 100;
}

/**
 * Send visit back to reception with an amount due (lab or pharmacy).
 */
export async function queueCashierCharge(visitDoc, { amount, charge_type }) {
  const payment = await Payment.findOne({ visit: visitDoc._id });
  if (!payment) {
    throw new Error('Payment record missing for visit');
  }
  const fee = Number(amount);
  if (Number.isNaN(fee) || fee < 0) {
    throw new Error('Invalid fee amount');
  }
  let due;
  if (charge_type === 'pharmacy') {
    /** Reception enters the amount when collecting (starts at 0). */
    due = fee;
  } else {
    due = fee > 0 ? fee : charge_type === 'lab' ? DEFAULT_LAB_TEST_PRICE : 0;
    if (due <= 0) {
      return null;
    }
  }

  visitDoc.status_before_cashier = visitDoc.visit_status;
  visitDoc.visit_status = VISIT_STATUS.SENT_TO_CASHIER;
  visitDoc.payment_status = PAYMENT_STATUS.UNPAID;
  payment.amount = due;
  payment.status = PAYMENT_STATUS.UNPAID;
  payment.charge_type = charge_type;
  await Promise.all([visitDoc.save(), payment.save()]);
  return { amount: due, charge_type };
}

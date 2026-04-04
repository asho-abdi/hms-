import mongoose from 'mongoose';
import { PAYMENT_STATUS } from '../config/constants.js';

export const PAYMENT_CHARGE_TYPES = ['consultation', 'lab', 'pharmacy'];

const paymentSchema = new mongoose.Schema(
  {
    visit: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit', required: true, unique: true },
    amount: { type: Number, required: true, min: 0, default: 0 },
    /** What the patient is paying for on this bill (consultation vs lab vs pharmacy). */
    charge_type: {
      type: String,
      enum: PAYMENT_CHARGE_TYPES,
      default: 'consultation',
    },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.UNPAID,
    },
    paid_at: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Payment = mongoose.model('Payment', paymentSchema);

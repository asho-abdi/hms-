import mongoose from 'mongoose';
import { VISIT_STATUS, PAYMENT_STATUS } from '../config/constants.js';

const visitMedicationLineSchema = new mongoose.Schema(
  {
    medication: { type: String, trim: true, default: '' },
    /** Dose, interval, duration (formulary sig or free text). */
    dosage: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const visitSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    /** Multiple medication lines (preferred). Denormalized `prescription` / `dosage` kept for legacy readers. */
    medications: { type: [visitMedicationLineSchema], default: [] },
    /** Medication / drug name and formulation (e.g. Paracetamol 500 mg tablets). */
    prescription: { type: String, trim: true, default: '' },
    /** @deprecated Use `prescription`; kept so older DB rows still load until re-saved. */
    diagnosis: { type: String, trim: true, default: '' },
    /** Dose per administration (e.g. 1 tablet, 500 mg, 10 mL). */
    dosage: { type: String, trim: true, default: '' },
    /** How often (e.g. BID, TID, every 8 hours). */
    frequency: { type: String, trim: true, default: '' },
    /** Route of administration code (e.g. PO, IV). */
    route: { type: String, trim: true, default: '' },
    /** Length of therapy (e.g. 7 days, until review). */
    duration: { type: String, trim: true, default: '' },
    doctor_notes: { type: String, trim: true, default: '' },
    visit_status: {
      type: String,
      enum: Object.values(VISIT_STATUS),
      default: VISIT_STATUS.SENT_TO_CASHIER,
    },
    /** Snapshot when visit is sent back to cashier for lab/pharmacy fees (restore after payment). */
    status_before_cashier: { type: String, default: null },
    /** True after we've queued a pharmacy charge for this visit (avoid duplicate billing). */
    pharmacy_charge_posted: { type: Boolean, default: false },
    payment_status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.UNPAID,
    },
  },
  { timestamps: true }
);

visitSchema.index({ patient: 1, createdAt: -1 });
visitSchema.index({ doctor: 1, payment_status: 1, visit_status: 1 });

export const Visit = mongoose.model('Visit', visitSchema);

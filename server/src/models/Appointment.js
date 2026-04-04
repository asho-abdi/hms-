import mongoose from 'mongoose';
import { APPOINTMENT_STATUS } from '../config/constants.js';

const appointmentSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date_time: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(APPOINTMENT_STATUS),
      default: APPOINTMENT_STATUS.SCHEDULED,
    },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

appointmentSchema.index({ date_time: 1, doctor: 1 });

export const Appointment = mongoose.model('Appointment', appointmentSchema);

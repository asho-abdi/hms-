import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema(
  {
    full_name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    gender: { type: String, enum: ['male', 'female'], required: true },
    dob: { type: Date, required: true },
    address: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

export const Patient = mongoose.model('Patient', patientSchema);

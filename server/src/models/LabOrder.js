import mongoose from 'mongoose';
import { LAB_ORDER_STATUS, LAB_PRIORITY } from '../config/constants.js';

const requestedTestSchema = new mongoose.Schema(
  {
    test: { type: mongoose.Schema.Types.ObjectId, ref: 'LabTest', required: true },
  },
  { _id: false }
);

const labOrderSchema = new mongoose.Schema(
  {
    visit: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit', required: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lab_ref_no: { type: Number, sparse: true, unique: true },
    /** Catalog requests (preferred). */
    requested_tests: { type: [requestedTestSchema], default: [] },
    /** Legacy free-text requests (older orders). */
    test_requests: [{ type: String, trim: true }],
    results: { type: [mongoose.Schema.Types.Mixed], default: [] },
    priority: {
      type: String,
      enum: Object.values(LAB_PRIORITY),
      default: LAB_PRIORITY.NORMAL,
    },
    notes: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: Object.values(LAB_ORDER_STATUS),
      default: LAB_ORDER_STATUS.PENDING,
    },
  },
  { timestamps: true }
);

labOrderSchema.index({ visit: 1, status: 1 });

export const LabOrder = mongoose.model('LabOrder', labOrderSchema);

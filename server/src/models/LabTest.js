import mongoose from 'mongoose';

export const LAB_TEST_TYPES = ['numeric', 'text', 'imaging'];

const labTestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'TestCategory', required: true },
    type: { type: String, enum: LAB_TEST_TYPES, required: true },
    /** Price billed when this test is ordered (lab fee sum for reception). */
    price: { type: Number, min: 0, default: 10 },
  },
  { timestamps: true }
);

labTestSchema.index({ category: 1, name: 1 }, { unique: true });

export const LabTest = mongoose.model('LabTest', labTestSchema);

import mongoose from 'mongoose';

const testCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    sort_order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

testCategorySchema.index({ sort_order: 1, name: 1 });

export const TestCategory = mongoose.model('TestCategory', testCategorySchema);

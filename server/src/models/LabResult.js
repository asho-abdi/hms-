import mongoose from 'mongoose';

const labResultSubValueSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    result_type: { type: String, enum: ['number', 'text', 'boolean'], required: true },
    value_number: { type: Number, default: null },
    value_text: { type: String, trim: true, default: '' },
    value_boolean: { type: Boolean, default: null },
    unit: { type: String, trim: true, default: '' },
    normal_range: { type: String, trim: true, default: '' },
    flag: { type: String, enum: ['LOW', 'NORMAL', 'HIGH', 'ABNORMAL', 'UNSET'], default: 'UNSET' },
  },
  { _id: false }
);

const labResultSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'LabOrder', required: true, index: true },
    visit: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit', required: true, index: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    test: { type: mongoose.Schema.Types.ObjectId, ref: 'LabTest', required: true },
    test_name: { type: String, required: true, trim: true },
    panel_parent_test: { type: mongoose.Schema.Types.ObjectId, ref: 'LabTest', default: null },
    panel_parent_name: { type: String, trim: true, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'TestCategory', default: null },
    category_name: { type: String, trim: true, default: '' },
    result_type: { type: String, enum: ['number', 'text', 'boolean', 'panel', 'imaging'], required: true },
    value_number: { type: Number, default: null },
    value_text: { type: String, trim: true, default: '' },
    value_boolean: { type: Boolean, default: null },
    unit: { type: String, trim: true, default: '' },
    normal_range: { type: String, trim: true, default: '' },
    flag: { type: String, enum: ['LOW', 'NORMAL', 'HIGH', 'ABNORMAL', 'UNSET'], default: 'UNSET' },
    panel_values: { type: [labResultSubValueSchema], default: [] },
  },
  { timestamps: true }
);

labResultSchema.index({ order: 1, test: 1 }, { unique: true });
labResultSchema.index({ visit: 1, createdAt: -1 });

export const LabResult = mongoose.model('LabResult', labResultSchema);

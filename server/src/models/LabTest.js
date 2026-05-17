import mongoose from 'mongoose';

export const LAB_TEST_TYPES = ['numeric', 'text', 'imaging'];
export const LAB_RESULT_TYPES = ['number', 'text', 'boolean', 'panel', 'imaging'];

const rangeSchema = new mongoose.Schema(
  {
    gender: { type: String, enum: ['ANY', 'MALE', 'FEMALE'], default: 'ANY' },
    min: { type: Number, default: null },
    max: { type: Number, default: null },
    text: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const panelSubTestSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    result_type: { type: String, enum: ['number', 'text', 'boolean'], default: 'number' },
    unit: { type: String, trim: true, default: '' },
    normal_ranges: { type: [rangeSchema], default: [] },
  },
  { _id: false }
);

const labTestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'TestCategory', required: true },
    /** Parent/child linkage for panel architecture (e.g., CBC -> WBC, RBC...). */
    parent_test: { type: mongoose.Schema.Types.ObjectId, ref: 'LabTest', default: null },
    child_tests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LabTest' }],
    type: { type: String, enum: LAB_TEST_TYPES, required: true },
    /** Reference normal range shown on lab entry / reports (when applicable). */
    normal_range: { type: String, trim: true, default: '' },
    /** Unit of measurement shown on lab entry / reports (when applicable). */
    unit: { type: String, trim: true, default: '' },
    /** Canonical result type used by lab result workflows. */
    result_type: { type: String, enum: LAB_RESULT_TYPES, default: 'number' },
    /** Flexible range structure (gender-aware ready). */
    normal_ranges: { type: [rangeSchema], default: [] },
    /** Expected normal value for text / boolean tests. */
    expected_value: { type: String, trim: true, default: '' },
    /** Child tests for panel-type orders such as CBC / ABG. */
    panel_subtests: { type: [panelSubTestSchema], default: [] },
    /** Price billed when this test is ordered (lab fee sum for reception). */
    price: { type: Number, min: 0, default: 10 },
  },
  { timestamps: true }
);

labTestSchema.index({ category: 1, name: 1 }, { unique: true });
labTestSchema.index({ parent_test: 1, name: 1 });

export const LabTest = mongoose.model('LabTest', labTestSchema);

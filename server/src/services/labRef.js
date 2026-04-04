import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

/** Sequential reference like 70001, 70002… (displayed as Lab Ref No). */
export async function nextLabRefNo() {
  const doc = await Counter.findOneAndUpdate({ _id: 'lab_ref' }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return 70000 + (doc.seq || 1);
}

import { TestCategory } from '../models/TestCategory.js';
import { LabTest } from '../models/LabTest.js';

/**
 * Ensures the seven lab categories and a starter catalog of tests exist (idempotent).
 */
const CATEGORIES = [
  { name: 'Blood Tests', sort_order: 0 },
  { name: 'Urine Tests', sort_order: 1 },
  { name: 'Infectious Disease Tests', sort_order: 2 },
  { name: 'Hormone Tests', sort_order: 3 },
  { name: 'Stool Tests', sort_order: 4 },
  { name: 'Microbiology Tests', sort_order: 5 },
  { name: 'Imaging (Radiology) Tests', sort_order: 6 },
];

/** @type {Record<string, { name: string, type: 'numeric' | 'text' | 'imaging' }[]>} */
const TESTS_BY_CATEGORY = {
  'Blood Tests': [
    { name: 'Hemoglobin', type: 'numeric' },
    { name: 'WBC', type: 'numeric' },
    { name: 'Platelet count', type: 'numeric' },
    { name: 'Blood glucose (fasting)', type: 'numeric' },
    { name: 'Serum creatinine', type: 'numeric' },
  ],
  'Urine Tests': [
    { name: 'Urine dipstick', type: 'text' },
    { name: 'Urine protein', type: 'text' },
    { name: 'Urine microscopy', type: 'text' },
  ],
  'Infectious Disease Tests': [
    { name: 'Malaria', type: 'text' },
    { name: 'HIV', type: 'text' },
    { name: 'Hepatitis B surface antigen', type: 'text' },
  ],
  'Hormone Tests': [
    { name: 'TSH', type: 'numeric' },
    { name: 'Free T4', type: 'numeric' },
  ],
  'Stool Tests': [
    { name: 'Occult blood', type: 'text' },
    { name: 'Parasite exam', type: 'text' },
  ],
  'Microbiology Tests': [
    { name: 'Urine culture', type: 'text' },
    { name: 'Blood culture', type: 'text' },
  ],
  'Imaging (Radiology) Tests': [
    { name: 'Chest X-Ray', type: 'imaging' },
    { name: 'Abdominal ultrasound', type: 'imaging' },
    { name: 'CT scan', type: 'imaging' },
  ],
};

export async function ensureLabCatalog() {
  if (process.env.DISABLE_LAB_CATALOG_SEED === 'true') {
    return;
  }

  const catByName = {};
  for (const c of CATEGORIES) {
    const doc = await TestCategory.findOneAndUpdate(
      { name: c.name },
      { $setOnInsert: { name: c.name, sort_order: c.sort_order } },
      { upsert: true, new: true }
    ).lean();
    catByName[c.name] = doc;
  }

  let testsAdded = 0;
  for (const [catName, tests] of Object.entries(TESTS_BY_CATEGORY)) {
    const catId = catByName[catName]?._id;
    if (!catId) continue;
    for (const t of tests) {
      const existing = await LabTest.findOne({ category: catId, name: t.name });
      if (existing) continue;
      await LabTest.create({ category: catId, name: t.name, type: t.type });
      testsAdded += 1;
    }
  }

  if (testsAdded > 0) {
    console.log(`[HMS] Lab catalog: added ${testsAdded} test definition(s).`);
  }

  const priceUp = await LabTest.updateMany(
    { $or: [{ price: { $exists: false } }, { price: null }] },
    { $set: { price: 10 } }
  );
  if (priceUp.modifiedCount > 0) {
    console.log(`[HMS] Lab catalog: set default price on ${priceUp.modifiedCount} test(s).`);
  }
}

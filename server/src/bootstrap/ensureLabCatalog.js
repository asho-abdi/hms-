import { TestCategory } from '../models/TestCategory.js';
import { LabTest } from '../models/LabTest.js';

/**
 * Ensures HMS lab categories + test definitions (with normal ranges / units) exist (idempotent).
 */
const CATEGORIES = [
  { name: 'Liver Function Tests', sort_order: 0 },
  { name: 'Renal Function Tests', sort_order: 1 },
  { name: 'Lipid Profile', sort_order: 2 },
  { name: 'Endocrinology/Hormone Tests', sort_order: 3 },
  { name: 'Vitamins', sort_order: 4 },
  { name: 'Electrolyte Panel', sort_order: 5 },
  { name: 'Hematology', sort_order: 6 },
  { name: 'Infectious Disease Tests', sort_order: 7 },
  { name: 'Cardiac Markers', sort_order: 8 },
  { name: 'Pregnancy Tests', sort_order: 9 },
  { name: 'Toxicology Tests', sort_order: 10 },
  { name: 'Microbiology Cultures', sort_order: 11 },
  { name: 'Tissue and Biopsy Tests', sort_order: 12 },
  { name: 'Allergy Testing', sort_order: 13 },
  { name: 'Blood Gas Analysis', sort_order: 14 },
  { name: 'Nutritional Deficiency Tests', sort_order: 15 },
  { name: 'Routine Tests', sort_order: 16 },
  { name: 'Coagulation Profile', sort_order: 17 },
  { name: 'Imaging (Radiology) Tests', sort_order: 18 },
];

/** @type {Record<string, { name: string, type: 'numeric' | 'text' | 'imaging', result_type?: 'number' | 'text' | 'boolean' | 'panel' | 'imaging', normal_range?: string, unit?: string, expected_value?: string, panel_subtests?: { key: string, name: string, result_type?: 'number' | 'text' | 'boolean', normal_range?: string, unit?: string }[] }[]>} */
const TESTS_BY_CATEGORY = {
  'Liver Function Tests': [
    { name: 'ALT (Alanine Aminotransferase)', type: 'numeric', normal_range: '7-56 U/L', unit: 'U/L' },
    { name: 'AST (Aspartate Aminotransferase)', type: 'numeric', normal_range: '10-40 U/L', unit: 'U/L' },
    { name: 'ALP (Alkaline Phosphatase)', type: 'numeric', normal_range: '44-147 U/L', unit: 'U/L' },
    { name: 'Bilirubin (Total)', type: 'numeric', normal_range: '0.1-1.2 mg/dL', unit: 'mg/dL' },
    { name: 'Albumin', type: 'numeric', normal_range: '3.4-5.4 g/dL', unit: 'g/dL' },
    { name: 'Total Protein', type: 'numeric', normal_range: '6.0-8.3 g/dL', unit: 'g/dL' },
  ],
  'Renal Function Tests': [
    { name: 'Creatinine', type: 'numeric', normal_range: '0.6-1.2 mg/dL', unit: 'mg/dL' },
    { name: 'BUN (Blood Urea Nitrogen)', type: 'numeric', normal_range: '7-20 mg/dL', unit: 'mg/dL' },
    { name: 'Uric Acid', type: 'numeric', normal_range: '3.5-7.2 mg/dL', unit: 'mg/dL' },
    {
      name: 'eGFR (Estimated Glomerular Filtration Rate)',
      type: 'numeric',
      normal_range: '>90 mL/min/1.73m2',
      unit: 'mL/min/1.73m2',
    },
  ],
  'Lipid Profile': [
    { name: 'Total Cholesterol', type: 'numeric', normal_range: '<200 mg/dL', unit: 'mg/dL' },
    { name: 'Triglycerides', type: 'numeric', normal_range: '<150 mg/dL', unit: 'mg/dL' },
    {
      name: 'HDL (High-Density Lipoprotein)',
      type: 'numeric',
      normal_range: '>40 mg/dL (men), >50 mg/dL (women)',
      unit: 'mg/dL',
    },
    { name: 'LDL (Low-Density Lipoprotein)', type: 'numeric', normal_range: '<100 mg/dL', unit: 'mg/dL' },
  ],
  'Endocrinology/Hormone Tests': [
    { name: 'T3 (Triiodothyronine)', type: 'numeric', normal_range: '80-200 ng/dL', unit: 'ng/dL' },
    { name: 'T4 (Thyroxine)', type: 'numeric', normal_range: '5-12 ug/dL', unit: 'ug/dL' },
    { name: 'TSH (Thyroid Stimulating Hormone)', type: 'numeric', normal_range: '0.4-4.0 mIU/L', unit: 'mIU/L' },
    { name: 'Insulin', type: 'numeric', normal_range: '2.6-24.9 uU/mL', unit: 'uU/mL' },
    { name: 'Growth Hormone', type: 'numeric', normal_range: '0-5 ng/mL', unit: 'ng/mL' },
    { name: 'Prolactin', type: 'numeric', normal_range: '4.8-23.3 ng/mL', unit: 'ng/mL' },
    { name: 'Testosterone', type: 'numeric', normal_range: '300-1000 ng/dL', unit: 'ng/dL' },
    { name: 'Estrogen', type: 'numeric', normal_range: '15-350 pg/mL', unit: 'pg/mL' },
    { name: 'Progesterone', type: 'numeric', normal_range: '5-20 ng/mL', unit: 'ng/mL' },
  ],
  Vitamins: [
    { name: 'Vitamin D (25-OH)', type: 'numeric', normal_range: '20-50 ng/mL', unit: 'ng/mL' },
    { name: 'Vitamin B12', type: 'numeric', normal_range: '200-900 pg/mL', unit: 'pg/mL' },
    { name: 'Folate (Vitamin B9)', type: 'numeric', normal_range: '3.1-17.5 ng/mL', unit: 'ng/mL' },
    { name: 'Vitamin B1 (Thiamine)', type: 'numeric', normal_range: '0-180 ng/mL', unit: 'ng/mL' },
    { name: 'Vitamin B6 (Pyridoxine)', type: 'numeric', normal_range: '5-50 ng/mL', unit: 'ng/mL' },
  ],
  'Electrolyte Panel': [
    { name: 'Sodium (Na)', type: 'numeric', normal_range: '136-145 mmol/L', unit: 'mmol/L' },
    { name: 'Potassium (K)', type: 'numeric', normal_range: '3.5-5.0 mmol/L', unit: 'mmol/L' },
    { name: 'Chloride (Cl)', type: 'numeric', normal_range: '98-106 mmol/L', unit: 'mmol/L' },
    { name: 'Calcium (Ca)', type: 'numeric', normal_range: '8.5-10.2 mg/dL', unit: 'mg/dL' },
    { name: 'Magnesium (Mg)', type: 'numeric', normal_range: '1.7-2.2 mg/dL', unit: 'mg/dL' },
  ],
  Hematology: [
    {
      name: 'CBC (Complete Blood Count)',
      type: 'text',
      result_type: 'panel',
      panel_subtests: [
        { key: 'wbc', name: 'WBC', result_type: 'number', normal_range: '4.0-11.0', unit: 'x10^9/L' },
        { key: 'rbc', name: 'RBC', result_type: 'number', normal_range: '4.2-5.9', unit: 'x10^12/L' },
        { key: 'hgb', name: 'Hemoglobin', result_type: 'number', normal_range: '12-17.5', unit: 'g/dL' },
        { key: 'hct', name: 'Hematocrit (HCT)', result_type: 'number', normal_range: '36-52', unit: '%' },
        { key: 'platelets', name: 'Platelets', result_type: 'number', normal_range: '150-450', unit: 'x10^9/L' },
        { key: 'mcv', name: 'MCV', result_type: 'number', normal_range: '80-100', unit: 'fL' },
        { key: 'mch', name: 'MCH', result_type: 'number', normal_range: '27-33', unit: 'pg' },
        { key: 'mchc', name: 'MCHC', result_type: 'number', normal_range: '32-36', unit: 'g/dL' },
      ],
    },
  ],
  'Infectious Disease Tests': [
    { name: 'HIV (Rapid Test)', type: 'text', normal_range: 'Negative' },
    { name: 'Hepatitis B Surface Antigen (HBsAg)', type: 'text', normal_range: 'Negative' },
    { name: 'Hepatitis C Antibodies', type: 'text', normal_range: 'Negative' },
    { name: 'Malaria Rapid Test', type: 'text', normal_range: 'Negative' },
    { name: 'Syphilis (VDRL)', type: 'text', normal_range: 'Negative' },
    { name: 'Toxoplasma gondii', type: 'text', normal_range: 'Negative' },
    { name: 'Tuberculosis (TB) Test', type: 'text', normal_range: 'Negative' },
  ],
  'Cardiac Markers': [
    { name: 'Troponin I', type: 'numeric', normal_range: '<0.04 ng/mL', unit: 'ng/mL' },
    { name: 'CK-MB (Creatine Kinase-MB)', type: 'numeric', normal_range: '<5 ng/mL', unit: 'ng/mL' },
    { name: 'BNP (B-type Natriuretic Peptide)', type: 'numeric', normal_range: '<100 pg/mL', unit: 'pg/mL' },
    { name: 'Myoglobin', type: 'numeric', normal_range: '<85 ng/mL', unit: 'ng/mL' },
    { name: 'Rheumatoid Factor (RF)', type: 'numeric', normal_range: '<20 IU/mL', unit: 'IU/mL' },
    { name: 'C-Reactive Protein (CRP)', type: 'numeric', normal_range: '<10 mg/L', unit: 'mg/L' },
  ],
  'Pregnancy Tests': [
    { name: 'HCG (Human Chorionic Gonadotropin)', type: 'numeric', normal_range: '<5 mIU/mL', unit: 'mIU/mL' },
    { name: 'Urine Pregnancy Test', type: 'text', result_type: 'boolean', normal_range: 'Negative', expected_value: 'Negative' },
  ],
  'Toxicology Tests': [
    { name: 'Alcohol (Blood Alcohol Concentration)', type: 'numeric', normal_range: '0-0.08%', unit: 'g/dL' },
    { name: 'Amphetamines (Urine Test)', type: 'text', normal_range: 'Negative' },
    { name: 'Opioids (Urine Test)', type: 'text', normal_range: 'Negative' },
  ],
  'Microbiology Cultures': [
    { name: 'Blood Culture', type: 'text', normal_range: 'Negative' },
    { name: 'Urine Culture', type: 'text', normal_range: 'Negative' },
    { name: 'Sputum Culture', type: 'text', normal_range: 'Negative' },
    { name: 'Wound Culture', type: 'text', normal_range: 'Negative' },
    { name: 'CSF (Cerebrospinal Fluid) Culture', type: 'text', normal_range: 'Negative' },
    { name: 'Stool Culture', type: 'text', normal_range: 'Negative' },
  ],
  'Tissue and Biopsy Tests': [
    { name: 'Histopathology', type: 'text', normal_range: 'No malignancy or abnormal findings' },
    { name: 'Cytology', type: 'text', normal_range: 'No abnormal cells' },
    { name: 'Tissue Culture', type: 'text', normal_range: 'Negative' },
    { name: 'Immunohistochemistry (IHC)', type: 'text', normal_range: 'Negative for specific markers' },
  ],
  'Allergy Testing': [
    {
      name: 'Allergen Panel (seasonal / food / pet)',
      type: 'text',
      normal_range: 'Negative',
    },
    { name: 'IgE (Immunoglobulin E)', type: 'numeric', normal_range: '<100 IU/mL', unit: 'IU/mL' },
  ],
  'Blood Gas Analysis': [
    {
      name: 'Arterial Blood Gas (ABG)',
      type: 'text',
      result_type: 'panel',
      panel_subtests: [
        { key: 'ph', name: 'pH', result_type: 'number', normal_range: '7.35-7.45', unit: 'pH' },
        { key: 'pco2', name: 'pCO2', result_type: 'number', normal_range: '35-45', unit: 'mmHg' },
        { key: 'po2', name: 'pO2', result_type: 'number', normal_range: '75-100', unit: 'mmHg' },
      ],
    },
    { name: 'Venous Blood Gas', type: 'text', normal_range: 'pH: 7.31-7.41', unit: 'pH' },
  ],
  'Nutritional Deficiency Tests': [
    { name: 'Ferritin', type: 'numeric', normal_range: '30-300 ng/mL', unit: 'ng/mL' },
    { name: 'TIBC', type: 'numeric', normal_range: '250-450 ug/dL', unit: 'ug/dL' },
    { name: 'Zinc', type: 'numeric', normal_range: '70-120 ug/dL', unit: 'ug/dL' },
    { name: 'Copper', type: 'numeric', normal_range: '70-140 ug/dL', unit: 'ug/dL' },
  ],
  'Routine Tests': [
    { name: 'Stool General', type: 'text', normal_range: 'No parasite seen' },
    { name: 'Urine General', type: 'text', normal_range: 'Normal' },
    { name: 'Blood Film for Malaria', type: 'text', normal_range: 'No parasite seen' },
    { name: 'ESR (Erythrocyte Sedimentation Rate)', type: 'numeric', normal_range: '0-15 mm/hr', unit: 'mm/hr' },
  ],
  'Coagulation Profile': [
    { name: 'INR', type: 'numeric', normal_range: '0.8-1.2', unit: 'Ratio' },
    { name: 'Prothrombin Time (PT)', type: 'numeric', normal_range: '12-14 seconds', unit: 'Seconds' },
    {
      name: 'Activated Partial Thromboplastin Time (aPTT)',
      type: 'numeric',
      normal_range: '25-35 seconds',
      unit: 'Seconds',
    },
    { name: 'Thrombin Time (TT)', type: 'numeric', normal_range: '14-19 seconds', unit: 'Seconds' },
    { name: 'Fibrinogen', type: 'numeric', normal_range: '200-400 mg/dL', unit: 'mg/dL' },
    { name: 'D-Dimer', type: 'numeric', normal_range: '<500 ng/mL', unit: 'ng/mL' },
  ],
  'Imaging (Radiology) Tests': [
    { name: 'Chest X-Ray', type: 'imaging', normal_range: 'No acute cardiopulmonary abnormality' },
    { name: 'Abdominal Ultrasound', type: 'imaging', normal_range: 'No significant abnormality' },
    { name: 'CT Scan', type: 'imaging', normal_range: 'No significant abnormality' },
  ],
};

function parseNumericRange(rangeText) {
  const t = String(rangeText || '').trim();
  if (!t) return [];
  const between = t.match(/^(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)/);
  if (between) {
    return [{ gender: 'ANY', min: Number(between[1]), max: Number(between[2]), text: t }];
  }
  const less = t.match(/^<\s*(-?\d+(?:\.\d+)?)/);
  if (less) return [{ gender: 'ANY', max: Number(less[1]), text: t }];
  const greater = t.match(/^>\s*(-?\d+(?:\.\d+)?)/);
  if (greater) return [{ gender: 'ANY', min: Number(greater[1]), text: t }];
  return [{ gender: 'ANY', text: t }];
}

export async function ensureLabCatalog() {
  if (process.env.DISABLE_LAB_CATALOG_SEED === 'true') {
    return;
  }

  const catByName = {};
  for (const c of CATEGORIES) {
    const doc = await TestCategory.findOneAndUpdate(
      { name: c.name },
      { $set: { sort_order: c.sort_order }, $setOnInsert: { name: c.name } },
      { upsert: true, new: true }
    ).lean();
    catByName[c.name] = doc;
  }

  let testsAdded = 0;
  let testsUpdated = 0;
  for (const [catName, tests] of Object.entries(TESTS_BY_CATEGORY)) {
    const catId = catByName[catName]?._id;
    if (!catId) continue;
    for (const t of tests) {
      const existing = await LabTest.findOne({ category: catId, name: t.name }).lean();
      const resultType = t.result_type || (t.type === 'numeric' ? 'number' : t.type === 'imaging' ? 'imaging' : 'text');
      const basePayload = {
        category: catId,
        name: t.name,
        type: t.type,
        result_type: resultType,
        normal_range: t.normal_range || '',
        normal_ranges: parseNumericRange(t.normal_range || ''),
        unit: t.unit || '',
        expected_value: t.expected_value || '',
      };
      let parentId = existing?._id || null;
      if (!existing) {
        const created = await LabTest.create({
          ...basePayload,
          panel_subtests: [],
          child_tests: [],
          parent_test: null,
        });
        parentId = created._id;
        testsAdded += 1;
      } else {
        const patch = {};
        if (existing.type !== t.type) patch.type = t.type;
        if ((existing.result_type || '') !== resultType) patch.result_type = resultType;
        if ((existing.normal_range || '') !== (t.normal_range || '')) patch.normal_range = t.normal_range || '';
        const nr = parseNumericRange(t.normal_range || '');
        if (JSON.stringify(existing.normal_ranges || []) !== JSON.stringify(nr)) patch.normal_ranges = nr;
        if ((existing.unit || '') !== (t.unit || '')) patch.unit = t.unit || '';
        if ((existing.expected_value || '') !== (t.expected_value || '')) patch.expected_value = t.expected_value || '';
        if (Object.keys(patch).length > 0) {
          await LabTest.updateOne({ _id: existing._id }, { $set: patch });
          testsUpdated += 1;
        }
      }

      const panel = (t.panel_subtests || []).map((s, idx) => ({
        key: s.key,
        name: s.name,
        result_type: s.result_type || 'number',
        unit: s.unit || '',
        normal_ranges: parseNumericRange(s.normal_range || ''),
        text: s.normal_range || '',
        sort_order: idx,
      }));
      const childIds = [];
      for (const s of t.panel_subtests || []) {
        const childResultType = s.result_type || 'number';
        const childType = childResultType === 'number' ? 'numeric' : childResultType === 'boolean' ? 'text' : 'text';
        const childExisting = await LabTest.findOne({ category: catId, name: s.name }).lean();
        const childPayload = {
          category: catId,
          name: s.name,
          type: childType,
          result_type: childResultType,
          parent_test: parentId,
          unit: s.unit || '',
          normal_range: s.normal_range || '',
          normal_ranges: parseNumericRange(s.normal_range || ''),
        };
        if (!childExisting) {
          const child = await LabTest.create({ ...childPayload, panel_subtests: [], child_tests: [] });
          childIds.push(child._id);
          testsAdded += 1;
        } else {
          childIds.push(childExisting._id);
          await LabTest.updateOne(
            { _id: childExisting._id },
            {
              $set: childPayload,
            }
          );
        }
      }
      await LabTest.updateOne(
        { _id: parentId },
        {
          $set: {
            parent_test: null,
            panel_subtests: panel,
            child_tests: childIds,
          },
        }
      );
      if (!(t.panel_subtests || []).length) {
        await LabTest.updateOne({ _id: parentId }, { $set: { child_tests: [], panel_subtests: [] } });
      }
    }
  }

  if (testsAdded > 0) {
    console.log(`[HMS] Lab catalog: added ${testsAdded} test definition(s).`);
  }
  if (testsUpdated > 0) {
    console.log(`[HMS] Lab catalog: updated ${testsUpdated} test definition(s).`);
  }

  // Remove legacy starter catalog entries that are not part of the HMS-approved catalog list.
  const allowedCategoryNames = new Set(CATEGORIES.map((c) => c.name));
  const allowedTestKeys = new Set();
  for (const [catName, tests] of Object.entries(TESTS_BY_CATEGORY)) {
    for (const t of tests) {
      allowedTestKeys.add(`${catName}::${t.name}`);
      for (const s of t.panel_subtests || []) {
        allowedTestKeys.add(`${catName}::${s.name}`);
      }
    }
  }

  const allCategories = await TestCategory.find().lean();
  const catNameById = new Map(allCategories.map((c) => [String(c._id), c.name]));
  const allTests = await LabTest.find({}, '_id category name').lean();

  const staleTestIds = allTests
    .filter((t) => {
      const catName = catNameById.get(String(t.category)) || '';
      if (!allowedCategoryNames.has(catName)) return true;
      return !allowedTestKeys.has(`${catName}::${t.name}`);
    })
    .map((t) => t._id);
  if (staleTestIds.length > 0) {
    await LabTest.deleteMany({ _id: { $in: staleTestIds } });
    console.log(`[HMS] Lab catalog: removed ${staleTestIds.length} legacy test definition(s).`);
  }

  const staleCategories = await TestCategory.find({ name: { $nin: [...allowedCategoryNames] } }, '_id').lean();
  if (staleCategories.length > 0) {
    await TestCategory.deleteMany({ _id: { $in: staleCategories.map((c) => c._id) } });
    console.log(`[HMS] Lab catalog: removed ${staleCategories.length} legacy categor(ies).`);
  }

  const priceUp = await LabTest.updateMany(
    { $or: [{ price: { $exists: false } }, { price: null }] },
    { $set: { price: 10 } }
  );
  if (priceUp.modifiedCount > 0) {
    console.log(`[HMS] Lab catalog: set default price on ${priceUp.modifiedCount} test(s).`);
  }
}

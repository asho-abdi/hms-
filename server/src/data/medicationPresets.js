/**
 * Standard outpatient / emergency formulary orders (display + structured fields for EMR).
 * Served via GET /api/visits/medication-presets — extend here or move to DB later for admin CRUD.
 */
export const MEDICATION_PRESETS = [
  {
    id: 'artemether-lumefantrine',
    medication: 'Artemether-Lumefantrine',
    sig: '4 tablets twice daily for 3 days',
  },
  {
    id: 'paracetamol',
    medication: 'Paracetamol',
    sig: '500mg every 6–8 hours',
  },
  {
    id: 'amoxicillin',
    medication: 'Amoxicillin',
    sig: '500mg every 8 hours for 5–7 days',
  },
  {
    id: 'ibuprofen',
    medication: 'Ibuprofen',
    sig: '400mg every 8 hours after food',
  },
  {
    id: 'metformin',
    medication: 'Metformin',
    sig: '500mg twice daily after meals',
  },
  {
    id: 'amlodipine',
    medication: 'Amlodipine',
    sig: '5mg once daily',
  },
  {
    id: 'omeprazole',
    medication: 'Omeprazole',
    sig: '20mg once daily before breakfast',
  },
  {
    id: 'vitamin-c',
    medication: 'Vitamin C',
    sig: '500mg once daily',
  },
  {
    id: 'cough-syrup',
    medication: 'Cough Syrup',
    sig: '10ml 3 times daily',
  },
  {
    id: 'ors',
    medication: 'ORS',
    sig: '1 sachet after each loose stool',
  },
  {
    id: 'zinc',
    medication: 'Zinc',
    sig: '20mg once daily for 10–14 days',
  },
].map((p) => ({
  ...p,
  label: `${p.medication} — ${p.sig}`,
}));

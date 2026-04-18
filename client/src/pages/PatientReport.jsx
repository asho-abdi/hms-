import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client.js';
import { isDisplayableImageUrl } from '../utils/mediaUrl.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '../constants/roles.js';
import '../styles/formal-report.css';
import '../styles/patient-report-page.css';

const LAB_COMPLETED = 'COMPLETED';

const CATEGORY_ORDER = [
  'Liver Function Tests',
  'Renal Function Tests',
  'Lipid Profile',
  'Endocrinology/Hormone Tests',
  'Vitamins',
  'Electrolyte Panel',
  'Infectious Disease Tests',
  'Cardiac Markers',
  'Pregnancy Tests',
  'Toxicology Tests',
  'Microbiology Cultures',
  'Tissue and Biopsy Tests',
  'Allergy Testing',
  'Blood Gas Analysis',
  'Nutritional Deficiency Tests',
  'General Screening Tests',
  'Coagulation Profile',
  'Imaging (Radiology) Tests',
  'Other',
];

function sortCategoryKeys(a, b) {
  const ia = CATEGORY_ORDER.indexOf(a);
  const ib = CATEGORY_ORDER.indexOf(b);
  const va = ia === -1 ? 999 : ia;
  const vb = ib === -1 ? 999 : ib;
  if (va !== vb) return va - vb;
  return a.localeCompare(b);
}

function formatDateOnly(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

function ageFromDob(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  const t = new Date();
  let age = t.getFullYear() - d.getFullYear();
  const md = t.getMonth() - d.getMonth();
  if (md < 0 || (md === 0 && t.getDate() < d.getDate())) age -= 1;
  return age;
}

function patientPid(id) {
  if (!id) return '—';
  return `PID-${String(id).slice(-6).toUpperCase()}`;
}

function labRefFallback(orderId) {
  if (!orderId) return '—';
  return (parseInt(String(orderId).slice(-8), 16) % 900000) + 10000;
}

function mapResultsForReport(results) {
  return (results || []).map((r) => {
    const category_name = r.category_name != null ? String(r.category_name) : '';
    if (r.type === 'numeric') {
      return {
        kind: 'numeric',
        category_name,
        test_name: r.parameter,
        result: String(r.value),
        n_range: r.normal_range != null && r.normal_range !== '' ? String(r.normal_range) : '—',
        uom: r.unit != null && r.unit !== '' ? String(r.unit) : '—',
        image_url: '',
      };
    }
    if (r.type === 'imaging') {
      return {
        kind: 'imaging',
        category_name,
        test_name: r.test_name,
        result: String(r.report ?? ''),
        n_range: '—',
        uom: '—',
        image_url: r.image_url != null && r.image_url !== '' ? String(r.image_url) : '',
      };
    }
    return {
      kind: 'text',
      category_name,
      test_name: r.test_name,
      result: String(r.result ?? ''),
      n_range: '—',
      uom: '—',
      image_url: '',
    };
  });
}

function rowsForLabOrder(lo) {
  if (lo.status === LAB_COMPLETED && lo.results?.length) {
    return mapResultsForReport(lo.results);
  }
  const rt = lo.requested_tests || [];
  if (rt.length) {
    return rt.map((line) => {
      const t = line.test;
      const name = typeof t === 'object' && t?.name ? t.name : 'Test';
      const cat = typeof t === 'object' && t?.category?.name ? String(t.category.name) : '';
      return {
        kind: 'pending',
        category_name: cat,
        test_name: name,
        result: 'Pending',
        n_range: '—',
        uom: '—',
        image_url: '',
      };
    });
  }
  return (lo.test_requests || []).map((name) => ({
    kind: 'pending',
    category_name: '',
    test_name: name,
    result: 'Pending',
    n_range: '—',
    uom: '—',
    image_url: '',
  }));
}

function formatSex(g) {
  if (!g) return '—';
  return g.charAt(0).toUpperCase() + g.slice(1);
}

const ROUTE_LABELS = {
  PO: 'Oral (PO)',
  IV: 'Intravenous (IV)',
  IM: 'Intramuscular (IM)',
  SC: 'Subcutaneous (SC)',
  TOPICAL: 'Topical',
  SL: 'Sublingual (SL)',
  PR: 'Rectal (PR)',
  INHALATION: 'Inhalation',
  OTHER: 'Other',
};

/** Medication + structured dose / frequency / route / duration for printed report. */
function formatVisitPrescription(v) {
  const medLines = [];
  if (Array.isArray(v.medications) && v.medications.length > 0) {
    for (const m of v.medications) {
      const name = (m.medication || '').trim();
      const sig = (m.dosage || '').trim();
      if (name && sig) medLines.push(`${name} — ${sig}`);
      else if (name) medLines.push(name);
      else if (sig) medLines.push(sig);
    }
  }
  const medBlock = medLines.length > 0 ? medLines.join('\n\n') : (v.prescription || '').trim();
  const lines = [];
  if (!medLines.length && v.dosage?.trim()) lines.push(`Dosage: ${v.dosage.trim()}`);
  if (v.frequency?.trim()) lines.push(`Frequency: ${v.frequency.trim()}`);
  const rt = (v.route || '').trim();
  if (rt) lines.push(`Route: ${ROUTE_LABELS[rt] || rt}`);
  if (v.duration?.trim()) lines.push(`Duration: ${v.duration.trim()}`);
  const sig = lines.join('\n');
  if (!medBlock && !sig) return '—';
  if (!medBlock) return sig;
  if (!sig) return medBlock;
  return `${medBlock}\n\n${sig}`;
}

export function PatientReport() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const backHref = user?.role === ROLES.DOCTOR ? '/dashboard/doctor' : '/patients';
  const backLabel = user?.role === ROLES.DOCTOR ? 'Doctor dashboard' : 'Patients';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: res } = await api.get(`/patients/${id}/report`);
        if (!cancelled) setData(res);
      } catch {
        toast.error('Could not load report');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const print = () => window.print();

  const generated = useMemo(() => new Date(), []);

  const visitsChrono = useMemo(() => {
    if (!data?.visits) return [];
    return [...data.visits].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [data]);

  const labBlocks = useMemo(() => {
    const blocks = [];
    for (const v of visitsChrono) {
      const orders = v.lab_orders || [];
      for (const lo of orders) {
        blocks.push(lo);
      }
    }
    return blocks;
  }, [visitsChrono]);

  const labRowsByCategory = useMemo(() => {
    const map = new Map();
    for (const lo of labBlocks) {
      if (lo.status !== LAB_COMPLETED || !lo.results?.length) continue;
      const refNo = lo.lab_ref_no ?? labRefFallback(lo._id);
      for (const row of mapResultsForReport(lo.results)) {
        const cat = row.category_name?.trim() || 'Other';
        if (!map.has(cat)) map.set(cat, []);
        map.get(cat).push({ ...row, lab_ref: refNo });
      }
    }
    const keys = [...map.keys()].sort(sortCategoryKeys);
    return { map, keys };
  }, [labBlocks]);

  const pendingLabOrders = useMemo(() => labBlocks.filter((lo) => lo.status !== LAB_COMPLETED), [labBlocks]);

  /** Doctor shown in header — most recent visit (same report may list multiple historical encounters in the table). */
  const attendingDoctor = useMemo(() => {
    if (!visitsChrono.length) return null;
    const latest = [...visitsChrono].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    return latest?.doctor?.fullName || null;
  }, [visitsChrono]);

  if (!data) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  const { patient } = data;
  const reportDate = generated.toISOString().slice(0, 10);
  const reportTime = generated.toTimeString().slice(0, 8);

  return (
    <div className="patient-report-standalone">
      <header className="patient-report-toolbar no-print">
        <Link to={backHref} className="patient-report-toolbar__back">
          ← {backLabel}
        </Link>
        {user?.role === ROLES.DOCTOR ? (
          <Link to="/dashboard/doctor/full-reports" className="patient-report-toolbar__link">
            Full reports
          </Link>
        ) : null}
        <span className="patient-report-toolbar__patient">{patient.full_name}</span>
        <span className="patient-report-toolbar__spacer" aria-hidden />
        <button type="button" className="btn btn-primary" onClick={print}>
          Print report
        </button>
      </header>

      <main className="patient-report-standalone__main">
        <div id="full-report" className="patient-report-standalone__content print-root">
          <div className="formal-report">
        <h1 className="formal-report__dept-title">Department of Medical Records</h1>

        <div className="formal-report__meta">
          <div className="formal-report__meta-col">
            <div className="formal-report__meta-row">
              <strong>Patient Name</strong>
              <span>{patient.full_name}</span>
            </div>
            <div className="formal-report__meta-row">
              <strong>Patient ID</strong>
              <span>{patientPid(patient._id)}</span>
            </div>
            <div className="formal-report__meta-row">
              <strong>Age</strong>
              <span>{ageFromDob(patient.dob) ?? '—'}</span>
            </div>
            <div className="formal-report__meta-row">
              <strong>Sex</strong>
              <span>{formatSex(patient.gender)}</span>
            </div>
            <div className="formal-report__meta-row">
              <strong>Tel No</strong>
              <span>{patient.phone || '—'}</span>
            </div>
            <div className="formal-report__meta-row">
              <strong>Address</strong>
              <span style={{ whiteSpace: 'pre-wrap' }}>{patient.address?.trim() ? patient.address.trim() : '—'}</span>
            </div>
          </div>
          <div className="formal-report__meta-col">
            <div className="formal-report__meta-row">
              <strong>Report Ref</strong>
              <span>RPT-{String(patient._id).slice(-6).toUpperCase()}</span>
            </div>
            <div className="formal-report__meta-row">
              <strong>Report Date</strong>
              <span>{reportDate}</span>
            </div>
            <div className="formal-report__meta-row">
              <strong>Report Time</strong>
              <span>{reportTime}</span>
            </div>
            <div className="formal-report__meta-row">
              <strong>Doctor</strong>
              <span>{attendingDoctor || '—'}</span>
            </div>
            <div className="formal-report__meta-row">
              <strong>Visits</strong>
              <span>{visitsChrono.length}</span>
            </div>
            <div className="formal-report__meta-row">
              <strong>DOB</strong>
              <span>{formatDateOnly(patient.dob)}</span>
            </div>
          </div>
        </div>

        <div className="formal-report__report-block">
          <h2 className="formal-report__section-title">Prescription report</h2>
          <p className="muted formal-report__section-lead" style={{ margin: '0 0 0.75rem', fontSize: '0.88rem' }}>
            Medication orders and dosing (chronological).
          </p>
          <div className="formal-report__table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Medication &amp; prescription</th>
                </tr>
              </thead>
              <tbody>
                {visitsChrono.length === 0 ? (
                  <tr>
                    <td style={{ textAlign: 'center', color: '#64748b' }}>No records on file</td>
                  </tr>
                ) : (
                  visitsChrono.map((v) => (
                    <tr key={`rx-${v._id}`}>
                      <td style={{ whiteSpace: 'pre-wrap', verticalAlign: 'top' }}>{formatVisitPrescription(v)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="formal-report__report-block formal-report__notes-report">
          <h2 className="formal-report__section-title">Doctor notes report</h2>
          <p className="muted formal-report__section-lead" style={{ margin: '0 0 0.75rem', fontSize: '0.88rem' }}>
            Clinical notes recorded by the physician (chronological).
          </p>
          <div className="formal-report__table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Doctor notes</th>
                </tr>
              </thead>
              <tbody>
                {visitsChrono.length === 0 ? (
                  <tr>
                    <td style={{ textAlign: 'center', color: '#64748b' }}>No records on file</td>
                  </tr>
                ) : (
                  visitsChrono.map((v) => (
                    <tr key={`notes-${v._id}`}>
                      <td style={{ whiteSpace: 'pre-wrap', verticalAlign: 'top' }}>{v.doctor_notes?.trim() ? v.doctor_notes.trim() : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <h2 className="formal-report__section-title" style={{ marginTop: '1.5rem' }}>
          Laboratory results (by category)
        </h2>
        {labRowsByCategory.keys.length === 0 && pendingLabOrders.length === 0 ? (
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            No laboratory results on file.
          </p>
        ) : null}
        {labRowsByCategory.keys.map((cat) => (
          <div key={cat} style={{ breakInside: 'avoid' }} className="patient-report__lab-category">
            <h3 className="formal-report__subsection">{cat}</h3>
            <div className="formal-report__table-wrap">
              <table className="formal-report__table--lab">
                <thead>
                  <tr>
                    <th>Lab ref</th>
                    <th>Test</th>
                    <th>Result</th>
                    <th>N Range</th>
                    <th>UOM</th>
                  </tr>
                </thead>
                <tbody>
                  {(labRowsByCategory.map.get(cat) || []).map((row, i) => {
                    const imgUrl = row.image_url && String(row.image_url).trim();
                    const showImg = row.kind === 'imaging' && imgUrl && isDisplayableImageUrl(imgUrl);
                    return (
                      <Fragment key={`${row.lab_ref}-${i}`}>
                        <tr>
                          <td>{row.lab_ref}</td>
                          <td>{row.test_name}</td>
                          <td style={{ fontFamily: 'var(--mono)', whiteSpace: 'pre-wrap' }}>{row.result}</td>
                          <td style={{ whiteSpace: 'pre-wrap' }}>{row.n_range}</td>
                          <td>{row.uom}</td>
                        </tr>
                        {showImg ? (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center' }}>
                              <img
                                src={imgUrl}
                                alt=""
                                style={{ maxHeight: '260px', maxWidth: '100%', objectFit: 'contain' }}
                              />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {pendingLabOrders.length > 0 ? (
          <div style={{ breakInside: 'avoid', marginTop: '1.25rem' }}>
            <h3 className="formal-report__subsection">Pending or incomplete lab orders</h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
              {pendingLabOrders.map((lo) => {
                const refNo = lo.lab_ref_no ?? labRefFallback(lo._id);
                const rows = rowsForLabOrder(lo);
                return (
                  <li key={String(lo._id)} style={{ marginBottom: '0.5rem' }}>
                    <strong>Ref {refNo}</strong> — {lo.status.replace(/_/g, ' ')}
                    <div className="formal-report__table-wrap" style={{ marginTop: '0.35rem' }}>
                      <table className="formal-report__table--lab">
                        <thead>
                          <tr>
                            <th>Test</th>
                            <th>Result</th>
                            <th>N Range</th>
                            <th>UOM</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, i) => (
                            <tr key={i}>
                              <td>{row.test_name}</td>
                              <td style={{ fontFamily: 'var(--mono)', whiteSpace: 'pre-wrap' }}>{row.result}</td>
                              <td style={{ whiteSpace: 'pre-wrap' }}>{row.n_range}</td>
                              <td>{row.uom}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className="formal-report__signature">
          <div className="formal-report__signature-box">
            <div className="formal-report__signature-line" aria-hidden />
            <div className="formal-report__signature-label">Physician signature</div>
          </div>
        </div>
          </div>
        </div>
      </main>
    </div>
  );
}

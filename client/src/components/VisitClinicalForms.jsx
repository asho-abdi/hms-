import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client.js';
import { StatusBadge } from './StatusBadge.jsx';
import { MedicationFormularySearch } from './MedicationFormularySearch.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES, VISIT_STATUS, PAYMENT_STATUS } from '../constants/roles.js';
import './visit-prescription-lines.css';

function newMedKey() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function visitToMedicationRows(visit) {
  if (Array.isArray(visit.medications) && visit.medications.length > 0) {
    return visit.medications.map((row) => ({
      key: newMedKey(),
      medication: row.medication || '',
      dosage: row.dosage || '',
    }));
  }
  const pr = visit.prescription || visit.diagnosis || '';
  const d = visit.dosage || '';
  if (pr || d) return [{ key: newMedKey(), medication: pr, dosage: d }];
  return [{ key: newMedKey(), medication: '', dosage: '' }];
}

const RX_ROUTES = [
  { value: '', label: '— Route —' },
  { value: 'PO', label: 'Oral (PO)' },
  { value: 'IV', label: 'Intravenous (IV)' },
  { value: 'IM', label: 'Intramuscular (IM)' },
  { value: 'SC', label: 'Subcutaneous (SC)' },
  { value: 'TOPICAL', label: 'Topical' },
  { value: 'SL', label: 'Sublingual (SL)' },
  { value: 'PR', label: 'Rectal (PR)' },
  { value: 'INHALATION', label: 'Inhalation' },
  { value: 'OTHER', label: 'Other (describe under medication)' },
];

/**
 * Prescription & notes, complete visit — shared by Visit detail and doctor panels. (Lab requests: use Lab tests in the sidebar.)
 * @param {string} [adminDoctorId] - when set (admin), visit must belong to this doctor
 * @param {boolean} [omitSummaryCard] - hide patient strip + “Open full visit” on visit detail page
 */
export function VisitClinicalForms({ visitId, adminDoctorId, onUpdated, omitSummaryCard = false }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [notes, setNotes] = useState({
    route: 'PO',
    doctor_notes: '',
  });
  const [medications, setMedications] = useState([{ key: newMedKey(), medication: '', dosage: '' }]);
  const [reopening, setReopening] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!visitId) return;
    setLoading(true);
    try {
      const { data: res } = await api.get(`/visits/${visitId}`);
      setData(res);
      setMedications(visitToMedicationRows(res.visit));
      setNotes({
        route: res.visit.route || 'PO',
        doctor_notes: res.visit.doctor_notes || '',
      });
    } catch {
      toast.error('Could not load visit');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId]);

  const notify = () => {
    load();
    onUpdated?.();
  };

  const saveNotes = async (e) => {
    e.preventDefault();
    const lines = medications
      .map(({ medication, dosage }) => ({
        medication: (medication || '').trim(),
        dosage: (dosage || '').trim(),
      }))
      .filter((x) => x.medication || x.dosage);
    try {
      await api.patch(`/visits/${visitId}`, {
        medications: lines,
        frequency: '',
        route: notes.route,
        duration: '',
        doctor_notes: notes.doctor_notes,
      });
      toast.success('Prescription & notes saved');
      notify();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save');
    }
  };

  const complete = async () => {
    try {
      await api.post(`/visits/${visitId}/complete`);
      toast.success('Visit completed');
      notify();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cannot complete yet');
    }
  };

  const reopenForCorrections = async () => {
    setReopening(true);
    try {
      const { data } = await api.post(`/visits/${visitId}/reopen`);
      if (data?.visit) {
        setData(data);
        setMedications(visitToMedicationRows(data.visit));
        setNotes({
          route: data.visit.route || 'PO',
          doctor_notes: data.visit.doctor_notes || '',
        });
      } else {
        await load();
      }
      toast.success('Visit reopened');
      onUpdated?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not reopen visit');
    } finally {
      setReopening(false);
    }
  };

  if (!visitId) {
    return null;
  }

  if (loading && !data) {
    return (
      <div className="card" style={{ marginTop: '1rem' }}>
        <p className="muted" style={{ margin: 0 }}>
          Loading visit…
        </p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { visit, lab_orders: labOrders } = data;
  const docId = String(visit.doctor?._id || visit.doctor);
  const isDoctorUser = user.role === ROLES.DOCTOR;
  const isAdminUser = user.role === ROLES.ADMIN;

  const isMyVisit = isDoctorUser && docId === String(user?.id);
  const matchesPanelDoctor = isAdminUser && adminDoctorId && docId === String(adminDoctorId);

  const canActBase =
    visit.payment_status === PAYMENT_STATUS.PAID && visit.visit_status !== VISIT_STATUS.COMPLETED;

  const canDoctorAct = isDoctorUser && isMyVisit && canActBase;
  const canAdminAct = isAdminUser && matchesPanelDoctor && canActBase;
  const canAct = canDoctorAct || canAdminAct;

  const adminCanReopen =
    isAdminUser && (!adminDoctorId || String(visit.doctor?._id || visit.doctor) === String(adminDoctorId));
  const canReopen =
    visit.visit_status === VISIT_STATUS.COMPLETED &&
    visit.payment_status === PAYMENT_STATUS.PAID &&
    ((isDoctorUser && isMyVisit) || adminCanReopen);

  return (
    <>
      {!omitSummaryCard && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div>
              <div className="muted">Patient</div>
              <strong>{visit.patient?.full_name}</strong>
            </div>
            <div>
              <div className="muted">Visit status</div>
              <StatusBadge type="visit" value={visit.visit_status} />
            </div>
            <Link to={`/visits/${visitId}`} className="btn btn-ghost" style={{ marginLeft: 'auto' }}>
              Open full visit
            </Link>
          </div>
        </div>
      )}

      {isDoctorUser && !isMyVisit && (
        <p className="muted" style={{ marginTop: '1rem' }}>
          This visit is assigned to another doctor.
        </p>
      )}

      {isAdminUser && adminDoctorId && !matchesPanelDoctor && (
        <p className="muted" style={{ marginTop: '1rem' }}>
          This visit is not assigned to the doctor selected in the panel.
        </p>
      )}

      {canReopen && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>Visit completed</h2>
          <p className="muted" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
            Reopen to make corrections.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={reopening}
            onClick={reopenForCorrections}
          >
            {reopening ? 'Reopening…' : 'Reopen for corrections'}
          </button>
        </div>
      )}

      {canAct && (
        <>
          <div className="card" style={{ marginTop: '1rem' }}>
            <h2>Prescription & notes</h2>
            <p className="muted" style={{ marginBottom: '1rem', fontSize: '0.88rem' }}>
              Add medications and doctor notes.
            </p>
            <form onSubmit={saveNotes}>
              <div className="prescription-form">
                <div className="form-row prescription-form__medication" style={{ marginBottom: 0 }}>
                  <span className="label-like" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                    Formulary search
                  </span>
                  <MedicationFormularySearch
                    onSelect={(p) =>
                      setMedications((prev) => [...prev, { key: newMedKey(), medication: p.medication, dosage: p.sig }])
                    }
                  />
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <span
                    className="muted"
                    style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}
                  >
                    Prescription lines
                  </span>
                  <div className="rx-lines">
                    {medications.map((row, index) => (
                      <div key={row.key} className="rx-line">
                        <span className="rx-line__num">Line {index + 1}</span>
                        <div className="form-row" style={{ marginBottom: 0 }}>
                          <label htmlFor={`rx-med-${row.key}`}>Medication</label>
                          <input
                            id={`rx-med-${row.key}`}
                            className="input"
                            value={row.medication}
                            onChange={(e) =>
                              setMedications((prev) =>
                                prev.map((r) => (r.key === row.key ? { ...r, medication: e.target.value } : r))
                              )
                            }
                            placeholder=""
                            autoComplete="off"
                          />
                        </div>
                        <div className="form-row" style={{ marginBottom: 0 }}>
                          <label htmlFor={`rx-dose-${row.key}`}>Dosage &amp; schedule</label>
                          <input
                            id={`rx-dose-${row.key}`}
                            className="input"
                            value={row.dosage}
                            onChange={(e) =>
                              setMedications((prev) =>
                                prev.map((r) => (r.key === row.key ? { ...r, dosage: e.target.value } : r))
                              )
                            }
                            placeholder=""
                            autoComplete="off"
                          />
                        </div>
                        <button
                          type="button"
                          className="rx-line__remove"
                          disabled={medications.length <= 1}
                          onClick={() =>
                            setMedications((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== row.key)))
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="rx-lines-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() =>
                        setMedications((prev) => [...prev, { key: newMedKey(), medication: '', dosage: '' }])
                      }
                    >
                      + Add medication line
                    </button>
                  </div>
                </div>
                <div className="prescription-form__sig" style={{ marginTop: '1rem' }}>
                  <div className="form-row prescription-form__sig-intro" style={{ marginBottom: 0 }}>
                    <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>
                      Optional.
                    </span>
                  </div>
                  <div className="form-row" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                    <label htmlFor="rx-route">Route</label>
                    <select
                      id="rx-route"
                      className="select"
                      value={notes.route}
                      onChange={(e) => setNotes({ ...notes, route: e.target.value })}
                    >
                      {RX_ROUTES.map((r) => (
                        <option key={r.value || 'none'} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="form-row" style={{ marginTop: '1rem' }}>
                <label htmlFor="rx-doctor-notes">Doctor notes</label>
                <textarea
                  id="rx-doctor-notes"
                  className="textarea"
                  value={notes.doctor_notes}
                  onChange={(e) => setNotes({ ...notes, doctor_notes: e.target.value })}
                  placeholder=""
                />
              </div>
              <button type="submit" className="btn btn-primary">
                Save
              </button>
            </form>
          </div>

          <div className="card" style={{ marginTop: '1rem' }}>
            <h2>Complete visit</h2>
            <p className="muted" style={{ marginBottom: '0.75rem' }}>
              Complete after clinical work and required labs are done.
            </p>
            <button type="button" className="btn btn-primary" onClick={complete}>
              Mark visit completed
            </button>
          </div>
        </>
      )}

      <div className="card" style={{ marginTop: '1rem' }}>
        <h2>Lab orders</h2>
        {(!labOrders || labOrders.length === 0) && <p className="muted">No lab orders for this visit.</p>}
        <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {labOrders?.map((lo) => (
            <li key={lo._id} style={{ marginBottom: '0.5rem' }}>
              <Link to={lo.status === 'COMPLETED' ? `/lab/${lo._id}/report` : `/lab/${lo._id}`}>
                Order · {new Date(lo.createdAt).toLocaleString()}
                {lo.status === 'COMPLETED' ? ' (report)' : ''}
              </Link>
              {' — '}
              <StatusBadge type="lab" value={lo.status} />
              {lo.requested_tests?.length
                ? ` · ${lo.requested_tests.map((x) => x.test?.name).filter(Boolean).join(', ')}`
                : lo.test_requests?.length
                  ? ` · ${lo.test_requests.join(', ')}`
                  : ''}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

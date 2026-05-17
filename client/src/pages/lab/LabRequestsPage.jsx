import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/client.js';
import { LabCatalogPicker } from '../../components/LabCatalogPicker.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLES, LAB_ORDER_STATUS, LAB_PRIORITY } from '../../constants/roles.js';
import './lab-requests.css';

function formatWhen(d) {
  if (!d) return '';
  return new Date(d).toLocaleString();
}

function orderTitle(o) {
  const rt = o.requested_tests || [];
  if (rt.length && rt[0]?.test?.name) {
    const head = rt[0].test.name;
    const rest = rt.length > 1 ? ` +${rt.length - 1} more` : '';
    return { title: head, rest };
  }
  const tr = o.test_requests || [];
  if (tr.length) {
    return { title: tr[0], rest: tr.length > 1 ? ` +${tr.length - 1} more` : '' };
  }
  return { title: 'Lab order', rest: '' };
}

export function LabRequestsPage() {
  const { user } = useAuth();
  const isDoctorOrAdmin = user.role === ROLES.DOCTOR || user.role === ROLES.ADMIN;
  const isLab = user.role === ROLES.LAB;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [visits, setVisits] = useState([]);
  const [visitQuery, setVisitQuery] = useState('');
  const [visitOpen, setVisitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const visitComboboxRef = useRef(null);

  const [selectedTestIds, setSelectedTestIds] = useState([]);
  const [form, setForm] = useState({
    visitId: '',
    priority: LAB_PRIORITY.NORMAL,
    notes: '',
  });

  const filteredVisits = useMemo(() => {
    const q = visitQuery.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    if (!q) return visits.slice(0, 60);
    return visits
      .filter((v) => {
        const name = String(v.patient?.full_name || '').toLowerCase();
        const phone = String(v.patient?.phone || '').replace(/\D/g, '');
        return name.includes(q) || (digits.length > 0 && phone.includes(digits));
      })
      .slice(0, 60);
  }, [visits, visitQuery]);

  useEffect(() => {
    const onDocDown = (e) => {
      if (!visitComboboxRef.current?.contains(e.target)) setVisitOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/lab/orders', { params: { limit: 50 } });
      setOrders(data.items || []);
    } catch {
      toast.error('Could not load lab tests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const openModal = async () => {
    setModalOpen(true);
    try {
      const { data } = await api.get('/lab/eligible-visits');
      setVisits(data.items || []);
      if (!data.items?.length) {
        toast('No eligible visits found.', { duration: 4000 });
      }
    } catch {
      toast.error('Could not load visits');
    }
  };

  const submitRequest = async (e) => {
    e.preventDefault();
    if (!form.visitId) {
      toast.error('Select a visit');
      return;
    }
    if (!selectedTestIds.length) {
      toast.error('Select at least one test from the catalog');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/lab/orders', {
        visitId: form.visitId,
        testIds: selectedTestIds,
        priority: form.priority,
        notes: form.notes,
      });
      toast.success('Lab test requested');
      setModalOpen(false);
      setSelectedTestIds([]);
      setVisitQuery('');
      setVisitOpen(false);
      setForm({ visitId: '', priority: LAB_PRIORITY.NORMAL, notes: '' });
      loadOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  const pickVisit = (v) => {
    setForm((prev) => ({ ...prev, visitId: v._id }));
    setVisitQuery(v.patient?.full_name || 'Patient');
    setVisitOpen(false);
  };

  return (
    <div className="lab-requests-page">
      <div className="lab-requests-header">
        <div>
          <h2 className="page-title" style={{ marginBottom: '0.25rem' }}>
            Lab tests
          </h2>
          <p className="muted" style={{ margin: 0 }}>
            Request, track, and review lab tests.
          </p>
        </div>
        {isDoctorOrAdmin && (
          <button type="button" className="btn btn-primary lab-requests-cta" onClick={openModal}>
            + Request lab test
          </button>
        )}
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : orders.length === 0 ? (
        <div className="card lab-requests-empty">
          <p className="muted" style={{ margin: 0 }}>
            {isDoctorOrAdmin ? 'No lab tests yet.' : 'No requests yet.'}
          </p>
        </div>
      ) : (
        <ul className="lab-requests-list">
          {orders.map((o) => {
            const { title, rest } = orderTitle(o);
            const patientName = o.patient?.full_name || 'Patient';
            const pri = o.priority === LAB_PRIORITY.URGENT ? 'Urgent' : 'Normal';
            const done = o.status === LAB_ORDER_STATUS.COMPLETED;
            const inProgress = o.status === LAB_ORDER_STATUS.IN_PROGRESS;

            return (
              <li key={o._id} className="lab-request-card">
                <div className="lab-request-card__icon" aria-hidden>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M9 3h6v2H9V3zm2 4h2v2h-2V7zM7 9h10v10a2 2 0 01-2 2H9a2 2 0 01-2-2V9zm2 2v6h6v-6H9z"
                      fill="currentColor"
                      opacity="0.85"
                    />
                  </svg>
                </div>
                <div className="lab-request-card__body">
                  <div className="lab-request-card__title">
                    {title}
                    {rest}
                  </div>
                  <div className="lab-request-card__meta">
                    {patientName} · <span className={pri === 'Urgent' ? 'lab-priority-urgent' : ''}>{pri}</span>
                    {o.lab_ref_no ? ` · Ref #${o.lab_ref_no}` : ''}
                  </div>
                </div>
                <div className="lab-request-card__side">
                  <span className={`lab-status-pill lab-status-pill--${done ? 'done' : inProgress ? 'progress' : 'pending'}`}>
                    {done ? 'Completed' : inProgress ? 'In progress' : 'Pending'}
                  </span>
                  <div className="lab-request-card__actions">
                    {done ? (
                      <Link to={`/lab/${o._id}/report`} className="lab-view-link">
                        View report
                      </Link>
                    ) : isLab ? (
                      <Link to={`/lab/${o._id}`} className="lab-view-link">
                        {inProgress ? 'Continue entry' : 'Enter results'}
                      </Link>
                    ) : (
                      <Link to={`/lab/${o._id}`} className="lab-view-link muted-link">
                        Details
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modalOpen && (
        <div className="lab-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="lab-modal-title">
          <div className="lab-modal lab-modal--wide">
            <div className="lab-modal__head">
              <h2 id="lab-modal-title">Request lab test</h2>
              <button
                type="button"
                className="lab-modal__close"
                onClick={() => {
                  setModalOpen(false);
                  setSelectedTestIds([]);
                  setVisitQuery('');
                  setVisitOpen(false);
                  setForm({ visitId: '', priority: LAB_PRIORITY.NORMAL, notes: '' });
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={submitRequest}>
              <div className="form-row">
                <label htmlFor="lab-visit">Visit (patient)</label>
                <div className="patient-combobox" ref={visitComboboxRef}>
                  <input
                    id="lab-visit"
                    className="input"
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-expanded={visitOpen}
                    role="combobox"
                    value={visitQuery}
                    onChange={(e) => {
                      setVisitQuery(e.target.value);
                      setForm((prev) => ({ ...prev, visitId: '' }));
                      setVisitOpen(true);
                    }}
                    onFocus={() => setVisitOpen(true)}
                    placeholder="Search patient name or phone…"
                    required
                  />
                  {visitOpen && filteredVisits.length > 0 ? (
                    <ul className="patient-combobox__list" role="listbox" aria-label="Visits">
                      {filteredVisits.map((v) => (
                        <li key={v._id} role="presentation">
                          <button
                            type="button"
                            className="patient-combobox__option"
                            role="option"
                            aria-selected={form.visitId === v._id}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pickVisit(v)}
                          >
                            <span>{v.patient?.full_name || 'Patient'}</span>
                            <span className="muted" style={{ fontSize: '0.85em' }}>
                              {formatWhen(v.updatedAt)} · {String(v.visit_status || '').replace(/_/g, ' ')}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {visitOpen && filteredVisits.length === 0 ? (
                    <p className="patient-combobox__empty muted">
                      {visitQuery.trim()
                        ? 'No visits match your search.'
                        : 'No eligible paid visits available for lab request.'}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="form-row">
                <span className="lab-modal-label">Tests by category</span>
                <p className="muted" style={{ margin: '0 0 0.5rem', fontSize: '0.82rem' }}>
                  Select one or more tests.
                </p>
                <LabCatalogPicker selectedIds={selectedTestIds} onChange={setSelectedTestIds} />
              </div>
              <div className="form-row">
                <span className="lab-modal-label">Priority</span>
                <div className="lab-priority-toggle">
                  <button
                    type="button"
                    className={`lab-priority-btn ${form.priority === LAB_PRIORITY.NORMAL ? 'active' : ''}`}
                    onClick={() => setForm({ ...form, priority: LAB_PRIORITY.NORMAL })}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    className={`lab-priority-btn ${form.priority === LAB_PRIORITY.URGENT ? 'active urgent' : ''}`}
                    onClick={() => setForm({ ...form, priority: LAB_PRIORITY.URGENT })}
                  >
                    Urgent
                  </button>
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="lab-notes">Notes</label>
                <textarea
                  id="lab-notes"
                  className="textarea"
                  rows={3}
                  placeholder=""
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <button type="submit" className="btn btn-primary lab-modal-submit" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit request'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

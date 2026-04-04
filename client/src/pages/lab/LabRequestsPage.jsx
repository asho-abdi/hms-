import { useEffect, useState } from 'react';
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
  const [submitting, setSubmitting] = useState(false);

  const [selectedTestIds, setSelectedTestIds] = useState([]);
  const [form, setForm] = useState({
    visitId: '',
    priority: LAB_PRIORITY.NORMAL,
    notes: '',
  });

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
        toast(
          'No eligible visits. Patient must be checked in / walk-in, payment collected, and visit ready for the doctor.',
          { duration: 5000 }
        );
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
      setForm({ visitId: '', priority: LAB_PRIORITY.NORMAL, notes: '' });
      loadOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="lab-requests-page">
      <div className="lab-requests-header">
        <div>
          <h2 className="page-title" style={{ marginBottom: '0.25rem' }}>
            Lab tests
          </h2>
          <p className="muted" style={{ margin: 0 }}>
            Request tests from the standard catalog by category (blood, urine, imaging, etc.), track status, and open
            formal reports when results are ready.
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
            No lab tests yet. {isDoctorOrAdmin ? 'Use “Request lab test” after a visit is paid and ready.' : 'Waiting for doctors to submit requests.'}
          </p>
        </div>
      ) : (
        <ul className="lab-requests-list">
          {orders.map((o) => {
            const { title, rest } = orderTitle(o);
            const patientName = o.patient?.full_name || 'Patient';
            const pri = o.priority === LAB_PRIORITY.URGENT ? 'Urgent' : 'Normal';
            const done = o.status === LAB_ORDER_STATUS.COMPLETED;

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
                  <span className={`lab-status-pill lab-status-pill--${done ? 'done' : 'pending'}`}>{done ? 'Completed' : 'Pending'}</span>
                  <div className="lab-request-card__actions">
                    {done ? (
                      <Link to={`/lab/${o._id}/report`} className="lab-view-link">
                        View report
                      </Link>
                    ) : isLab ? (
                      <Link to={`/lab/${o._id}`} className="lab-view-link">
                        Enter results
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
                <select
                  id="lab-visit"
                  className="select"
                  required
                  value={form.visitId}
                  onChange={(e) => setForm({ ...form, visitId: e.target.value })}
                >
                  <option value="">Select visit…</option>
                  {visits.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.patient?.full_name || 'Patient'} · {formatWhen(v.updatedAt)} · {String(v.visit_status || '').replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <span className="lab-modal-label">Tests by category</span>
                <p className="muted" style={{ margin: '0 0 0.5rem', fontSize: '0.82rem' }}>
                  Select one or more catalog tests. Order on the lab order follows the order you select them.
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

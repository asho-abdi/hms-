import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '../constants/roles.js';

export function VisitList() {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const doctorFilter = searchParams.get('doctor');
  const isDoctor = user.role === ROLES.DOCTOR;
  const isAdmin = user.role === ROLES.ADMIN;
  const canWalkIn = user.role === ROLES.ADMIN || user.role === ROLES.RECEPTIONIST;
  const canViewDoctorQueue =
    user.role === ROLES.ADMIN || user.role === ROLES.RECEPTIONIST;
  const isDoctorPanelQueuePath = location.pathname.startsWith('/dashboard/doctor-panel/queue');

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [walkIn, setWalkIn] = useState({ patient: '', doctor: '' });
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isDoctor) {
        const { data } = await api.get('/visits/doctor-queue');
        setItems(data.items || []);
      } else if (doctorFilter && canViewDoctorQueue) {
        const { data } = await api.get('/visits/doctor-queue', { params: { doctor: doctorFilter } });
        setItems(data.items || []);
      } else {
        const { data } = await api.get('/visits', { params: { limit: 50 } });
        setItems(data.items || []);
      }
    } catch {
      toast.error('Failed to load visits');
    } finally {
      setLoading(false);
    }
  }, [isDoctor, doctorFilter, canViewDoctorQueue]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canWalkIn) return;
    let cancelled = false;
    (async () => {
      try {
        const [pts, docs] = await Promise.all([api.get('/patients', { params: { limit: 200 } }), api.get('/users/doctors')]);
        if (!cancelled) {
          setPatients(pts.data.items || []);
          setDoctors(docs.data.items || []);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canWalkIn]);

  const submitWalkIn = async (e) => {
    e.preventDefault();
    try {
      await api.post('/visits/walk-in', walkIn);
      toast.success('Walk-in created — patient is on Appointments, Visits, and Payments');
      setWalkIn({ patient: '', doctor: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const doctorQueueMode = !isDoctor && doctorFilter && canViewDoctorQueue;

  const openVisitHref = (visitId) => {
    const id = visitId != null ? String(visitId) : '';
    if (isDoctor) {
      return `/dashboard/doctor?visit=${encodeURIComponent(id)}`;
    }
    if (doctorQueueMode && isAdmin) {
      return `/dashboard/doctor-panel?visit=${encodeURIComponent(id)}&doctor=${encodeURIComponent(doctorFilter)}`;
    }
    return `/visits/${id}`;
  };

  if (isDoctorPanelQueuePath && isAdmin && !doctorFilter) {
    return <Navigate to="/dashboard/doctor-panel" replace />;
  }

  return (
    <>
      {doctorQueueMode && isAdmin && (
        <div className="toolbar no-print" style={{ marginBottom: '0.5rem' }}>
          <Link to="/dashboard/doctor-panel">← Doctor panel</Link>
        </div>
      )}
      <h2 className="page-title">
        {isDoctor ? 'My visit queue' : doctorQueueMode ? 'Visit queue' : 'Visits'}
      </h2>
      <p className="muted" style={{ marginBottom: '1rem' }}>
        {isDoctor
          ? 'Paid visits assigned to you.'
          : doctorQueueMode
            ? 'Paid visits for the selected doctor.'
            : 'All visits (unpaid and paid). New appointments appear here immediately.'}
      </p>

      {canWalkIn && !doctorQueueMode && (
        <div className="card card-stretch" style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Walk-in visit</h2>
          <form onSubmit={submitWalkIn}>
            <div className="form-grid-full">
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>Patient</label>
                <select className="select" required value={walkIn.patient} onChange={(e) => setWalkIn({ ...walkIn, patient: e.target.value })}>
                  <option value="">Select…</option>
                  {patients.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>Doctor</label>
                <select className="select" required value={walkIn.doctor} onChange={(e) => setWalkIn({ ...walkIn, doctor: e.target.value })}>
                  <option value="">Select…</option>
                  {doctors.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Create walk-in
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Payment</th>
              <th>Visit status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="empty-state">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-state">
                  No visits
                </td>
              </tr>
            ) : (
              items.map((v) => (
                <tr key={v._id}>
                  <td>{v.patient?.full_name}</td>
                  <td>{v.doctor?.fullName}</td>
                  <td>
                    <StatusBadge type="payment" value={v.payment_status} />
                  </td>
                  <td>
                    <StatusBadge type="visit" value={v.visit_status} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link to={openVisitHref(v._id)}>Open</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

import { useCallback, useEffect, useState } from 'react';

const RESET_CONFIRM_PHRASE = 'RESET_ALL_PATIENT_DATA';
import { Link } from 'react-router-dom';
import {
  Users,
  UserCog,
  CalendarDays,
  ClipboardList,
  Wallet,
  FlaskConical,
  ShieldCheck,
  Stethoscope,
  Activity,
  Medal,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client.js';
import { RegisteredPatientsReport } from '../../components/RegisteredPatientsReport.jsx';
import './admin-overview.css';

export function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPhrase, setResetPhrase] = useState('');
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/admin/overview');
      setData(res);
    } catch {
      toast.error('Could not load overview');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runReset = async () => {
    if (resetPhrase.trim() !== RESET_CONFIRM_PHRASE) {
      toast.error('Type the confirmation phrase exactly');
      return;
    }
    setResetting(true);
    try {
      await api.post('/admin/reset-operational-data', { confirm: RESET_CONFIRM_PHRASE });
      toast.success('Operational data cleared — staff and lab catalog unchanged');
      setResetOpen(false);
      setResetPhrase('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed');
    } finally {
      setResetting(false);
    }
  };

  const counts = data?.counts;
  const byRole = data?.usersByRole || {};
  const doctorsRanked = data?.doctorsRanked || [];
  const topDoctor = doctorsRanked[0];

  return (
    <>
      <div className="admin-overview-hero">
        <h1 className="admin-overview-hero__title">At a glance</h1>
        <p className="admin-overview-hero__sub">
          Hospital-wide snapshot: registered patients (filterable), doctors ranked by distinct patients seen, and quick
          links to every module.
        </p>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card" style={{ '--admin-stat-accent': 'var(--primary)' }}>
          <div className="admin-stat-card__icon">
            <Users size={20} strokeWidth={2} aria-hidden />
          </div>
          <div className="admin-stat-card__value">{loading && !data ? '—' : counts?.users ?? '—'}</div>
          <div className="admin-stat-card__label">Staff users</div>
        </div>
        <div className="admin-stat-card" style={{ '--admin-stat-accent': 'var(--cyan)' }}>
          <div className="admin-stat-card__icon">
            <Activity size={20} strokeWidth={2} aria-hidden />
          </div>
          <div className="admin-stat-card__value">{loading && !data ? '—' : counts?.patients ?? '—'}</div>
          <div className="admin-stat-card__label">Patients registered</div>
        </div>
        <div className="admin-stat-card" style={{ '--admin-stat-accent': 'var(--purple)' }}>
          <div className="admin-stat-card__icon">
            <ClipboardList size={20} strokeWidth={2} aria-hidden />
          </div>
          <div className="admin-stat-card__value">{loading && !data ? '—' : counts?.visits ?? '—'}</div>
          <div className="admin-stat-card__label">Total visits</div>
        </div>
        <div className="admin-stat-card" style={{ '--admin-stat-accent': 'var(--warning)' }}>
          <div className="admin-stat-card__icon">
            <CalendarDays size={20} strokeWidth={2} aria-hidden />
          </div>
          <div className="admin-stat-card__value">{loading && !data ? '—' : counts?.scheduledAppointments ?? '—'}</div>
          <div className="admin-stat-card__label">Scheduled appointments</div>
        </div>
      </div>

      {Object.keys(byRole).length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '0.75rem' }}>Staff by role</h2>
          <p className="muted" style={{ marginBottom: '0.85rem' }}>
            Active accounts in each role.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {Object.entries(byRole).map(([role, n]) => (
              <span
                key={role}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: 999,
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                {role.replace(/_/g, ' ')}
                <strong style={{ color: 'var(--primary)' }}>{n}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 style={{ marginBottom: '0.75rem' }}>Shortcuts</h2>
        <p className="muted" style={{ marginBottom: '1rem' }}>
          Jump to operational areas.
        </p>
        <div className="admin-shortcuts">
          <Link className="admin-shortcut" to="/patients">
            <Users size={18} strokeWidth={2} aria-hidden />
            Patients
          </Link>
          <Link className="admin-shortcut" to="/appointments">
            <CalendarDays size={18} strokeWidth={2} aria-hidden />
            Appointments
          </Link>
          <Link className="admin-shortcut" to="/visits">
            <ClipboardList size={18} strokeWidth={2} aria-hidden />
            Visits
          </Link>
          <Link className="admin-shortcut" to="/dashboard/doctor-panel">
            <UserCog size={18} strokeWidth={2} aria-hidden />
            Doctor panel
          </Link>
          <Link className="admin-shortcut" to="/payments">
            <Wallet size={18} strokeWidth={2} aria-hidden />
            Payments
          </Link>
          <Link className="admin-shortcut" to="/lab-requests">
            <FlaskConical size={18} strokeWidth={2} aria-hidden />
            Lab tests
          </Link>
          <Link className="admin-shortcut" to="/admin/users">
            <ShieldCheck size={18} strokeWidth={2} aria-hidden />
            Staff users
          </Link>
        </div>
      </div>

      <div className="card admin-report-card">
        <h2>
          <Stethoscope size={22} strokeWidth={2} aria-hidden style={{ opacity: 0.85 }} />
          Doctors by patient reach
        </h2>
        <p className="muted" style={{ marginBottom: '1rem' }}>
          Ranked by number of <strong>distinct patients</strong> who have at least one visit with that doctor (all time).
        </p>
        {topDoctor ? (
          <div className="admin-top-doc">
            <div className="admin-top-doc__badge" aria-hidden>
              <Medal size={22} strokeWidth={2} />
            </div>
            <div>
              <p className="admin-top-doc__name">Top: {topDoctor.fullName}</p>
              <p className="admin-top-doc__meta">
                {topDoctor.patientCount} patient{topDoctor.patientCount === 1 ? '' : 's'}
                {topDoctor.speciality ? ` · ${topDoctor.speciality}` : ''}
              </p>
            </div>
          </div>
        ) : (
          <p className="muted" style={{ marginBottom: '1rem' }}>
            No visit data yet — rankings appear after doctors see patients.
          </p>
        )}
        {doctorsRanked.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Doctor</th>
                  <th>Speciality</th>
                  <th style={{ textAlign: 'right' }}>Distinct patients</th>
                </tr>
              </thead>
              <tbody>
                {doctorsRanked.map((d) => (
                  <tr key={String(d._id)}>
                    <td>
                      <span className={d.rank === 1 ? 'admin-rank-pill admin-rank-pill--gold' : 'admin-rank-pill'}>
                        #{d.rank}
                      </span>
                    </td>
                    <td>
                      <strong>{d.fullName}</strong>
                      <div className="muted" style={{ fontSize: '0.8rem' }}>
                        {d.email}
                      </div>
                    </td>
                    <td>{d.speciality || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <strong>{d.patientCount}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card admin-reset-card">
        <h2 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Trash2 size={20} strokeWidth={2} aria-hidden />
          Reset operational data
        </h2>
        <p className="muted" style={{ marginBottom: '1rem', lineHeight: 1.55 }}>
          If the system feels heavy from too many test registrations, you can remove all{' '}
          <strong>patients, visits, appointments, lab orders, payments</strong>, and uploaded lab images.{' '}
          <strong>Staff accounts</strong> and the <strong>lab test catalog</strong> are not removed. This action cannot be
          undone.
        </p>
        <button type="button" className="btn btn-danger" onClick={() => setResetOpen(true)}>
          Open reset…
        </button>
      </div>

      {resetOpen ? (
        <div
          className="admin-user-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-reset-title"
          onClick={() => {
            if (!resetting) setResetOpen(false);
          }}
        >
          <div className="card admin-user-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h2 id="admin-reset-title" style={{ marginBottom: '0.75rem' }}>
              Confirm full data reset
            </h2>
            <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '1rem', lineHeight: 1.5 }}>
              Type the phrase below exactly, then confirm. All patient-related records will be permanently deleted.
            </p>
            <p style={{ marginBottom: '0.65rem', fontSize: '0.85rem', fontFamily: 'var(--mono, monospace)' }}>
              {RESET_CONFIRM_PHRASE}
            </p>
            <div className="form-row">
              <label htmlFor="admin-reset-phrase">Confirmation phrase</label>
              <input
                id="admin-reset-phrase"
                className="input"
                value={resetPhrase}
                onChange={(e) => setResetPhrase(e.target.value)}
                autoComplete="off"
                placeholder={RESET_CONFIRM_PHRASE}
                disabled={resetting}
              />
            </div>
            <div className="form-actions" style={{ marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={resetting}
                onClick={() => {
                  setResetOpen(false);
                  setResetPhrase('');
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={resetting || resetPhrase.trim() !== RESET_CONFIRM_PHRASE}
                onClick={runReset}
              >
                {resetting ? 'Resetting…' : 'Reset database'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <RegisteredPatientsReport />
    </>
  );
}

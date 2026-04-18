import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/client.js';
import { RegisteredPatientsReport } from '../../components/RegisteredPatientsReport.jsx';

export function ReceptionDashboard() {
  const [today, setToday] = useState(null);
  const [unpaid, setUnpaid] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [apptRes, payRes] = await Promise.all([api.get('/appointments/today'), api.get('/payments/unpaid')]);
        if (!cancelled) {
          setToday(apptRes.data.items?.length ?? 0);
          setUnpaid(payRes.data.items?.length ?? 0);
        }
      } catch {
        if (!cancelled) toast.error('Could not load reception stats');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <p className="muted" style={{ marginBottom: '1.25rem' }}>
        Register patients, manage appointments, and collect payments.
      </p>
      <div className="grid-2">
        <div className="stat-card">
          <div className="value">{today ?? '—'}</div>
          <div className="label">Today (scheduled)</div>
        </div>
        <div className="stat-card">
          <div className="value">{unpaid ?? '—'}</div>
          <div className="label">Unpaid visits (awaiting payment)</div>
        </div>
      </div>
      <div className="card" style={{ marginTop: '1.25rem' }}>
        <p style={{ marginBottom: '0.75rem' }}>
          <Link to="/patients">Patients</Link>
          {' · '}
          <Link to="/payments">Payments & billing</Link>
          {' · '}
          <Link to="/appointments">Appointments & check-in</Link>
          {' · '}
          <Link to="/visits">Walk-in visits</Link>
        </p>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <RegisteredPatientsReport />
      </div>
    </>
  );
}

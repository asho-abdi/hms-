import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/client.js';
import { LAB_ORDER_STATUS } from '../../constants/roles.js';

export function LabDashboard() {
  const [pending, setPending] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/lab/orders', { params: { status: LAB_ORDER_STATUS.PENDING } });
        if (!cancelled) setPending(data.total ?? data.items?.length ?? 0);
      } catch {
        toast.error('Could not load lab queue');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <p className="muted" style={{ marginBottom: '1.25rem' }}>
        Review and complete pending lab orders.
      </p>
      <div className="grid-2">
        <div className="stat-card">
          <div className="value">{pending ?? '—'}</div>
          <div className="label">Pending orders</div>
        </div>
      </div>
      <div className="card" style={{ marginTop: '1.25rem' }}>
        <Link to="/lab-requests" className="btn btn-primary">
          Open lab tests
        </Link>
      </div>
    </>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { LAB_ORDER_STATUS } from '../constants/roles.js';

export function LabOrders() {
  const [filter, setFilter] = useState(LAB_ORDER_STATUS.PENDING);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/lab/orders', { params: { status: filter, limit: 50 } });
      setItems(data.items || []);
    } catch {
      toast.error('Could not load lab orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter]);

  return (
    <>
      <h2 className="page-title">Lab orders</h2>
      <div className="toolbar">
        <button type="button" className={`btn ${filter === LAB_ORDER_STATUS.PENDING ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(LAB_ORDER_STATUS.PENDING)}>
          Pending
        </button>
        <button type="button" className={`btn ${filter === LAB_ORDER_STATUS.COMPLETED ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(LAB_ORDER_STATUS.COMPLETED)}>
          Completed
        </button>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Requested tests</th>
              <th>Status</th>
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
                  No orders
                </td>
              </tr>
            ) : (
              items.map((o) => (
                <tr key={o._id}>
                  <td>{o.patient?.full_name}</td>
                  <td>{o.doctor?.fullName}</td>
                  <td style={{ maxWidth: 280 }}>{(o.test_requests || []).join(', ')}</td>
                  <td>
                    <StatusBadge type="lab" value={o.status} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link to={`/lab/${o._id}`}>Open</Link>
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

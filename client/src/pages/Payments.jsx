import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client.js';
import { StatusBadge } from '../components/StatusBadge.jsx';

function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}

function chargeTypeLabel(t) {
  if (t === 'lab') return 'Lab tests';
  if (t === 'pharmacy') return 'Pharmacy';
  return 'Consultation';
}

export function Payments() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState(null);
  const [amount, setAmount] = useState('');

  const [reportItems, setReportItems] = useState([]);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportFilter, setReportFilter] = useState('all');
  const [chargeFilter, setChargeFilter] = useState('all');
  const [reportPage, setReportPage] = useState(1);
  const [reportMeta, setReportMeta] = useState({ total: 0, pages: 1, limit: 50 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/payments/unpaid', {
        params: { charge_type: chargeFilter },
      });
      setItems(data.items || []);
    } catch {
      toast.error('Could not load unpaid visits');
    } finally {
      setLoading(false);
    }
  }, [chargeFilter]);

  const loadReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const { data } = await api.get('/payments/report', {
        params: { status: reportFilter, charge_type: chargeFilter, page: reportPage, limit: 50 },
      });
      setReportItems(data.items || []);
      setReportMeta({
        total: data.total ?? 0,
        pages: data.pages ?? 1,
        limit: data.limit ?? 50,
      });
    } catch {
      toast.error('Could not load payment report');
      setReportItems([]);
    } finally {
      setReportLoading(false);
    }
  }, [reportFilter, chargeFilter, reportPage]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const submitPay = async (visitId) => {
    const num = Number(amount);
    if (Number.isNaN(num) || num < 0) {
      toast.error('Enter a valid amount');
      return;
    }
    try {
      await api.patch(`/payments/visit/${visitId}/pay`, { amount: num });
      toast.success('Payment recorded');
      setPayingId(null);
      setAmount('');
      load();
      loadReport();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed');
    }
  };

  return (
    <>
      <h2 className="page-title">Payments & billing</h2>
      <p className="muted" style={{ marginBottom: '1.25rem' }}>
        Review unpaid visits and record payments.
      </p>
      <div className="toolbar" style={{ marginBottom: '0.9rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        {[
          { key: 'all', label: 'All fees' },
          { key: 'consultation', label: 'Consultation fee' },
          { key: 'lab', label: 'Lab test fee' },
          { key: 'pharmacy', label: 'Pharmacy fee' },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={chargeFilter === key ? 'btn btn-primary' : 'btn btn-ghost'}
            style={{ padding: '0.35rem 0.85rem' }}
            onClick={() => {
              setChargeFilter(key);
              setReportPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text)' }}>
        Unpaid visits
      </h3>
      <div className="table-wrap" style={{ marginBottom: '2rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Charge</th>
              <th>Visit status</th>
              <th>Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  No unpaid visits
                </td>
              </tr>
            ) : (
              items.map((p) => {
                const v = p.visit;
                if (!v) return null;
                return (
                  <tr key={p._id}>
                    <td>{v.patient?.full_name}</td>
                    <td>{v.doctor?.fullName}</td>
                    <td>
                      <span style={{ fontSize: '0.9rem' }}>{chargeTypeLabel(p.charge_type)}</span>
                      {p.charge_type === 'consultation' && v.doctor?.visitFee != null ? (
                        <span className="muted" style={{ display: 'block', fontSize: '0.78rem', marginTop: '0.15rem' }}>
                          Default visit fee: {Number(v.doctor.visitFee).toFixed(2)}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <StatusBadge type="visit" value={v.visit_status} />
                    </td>
                    <td>
                      {payingId === p._id ? (
                        <input
                          className="input"
                          style={{ maxWidth: 120 }}
                          type="number"
                          min={0}
                          step={0.01}
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder=""
                        />
                      ) : (
                        <span className="muted">{p.amount}</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {payingId === p._id ? (
                        <>
                          <button type="button" className="btn btn-primary" style={{ padding: '0.35rem 0.75rem' }} onClick={() => submitPay(v._id)}>
                            Confirm paid
                          </button>
                          {' · '}
                          <button type="button" className="link-btn" onClick={() => setPayingId(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <Link to={`/visits/${v._id}`}>Visit</Link>
                          {' · '}
                          <button type="button" className="btn btn-ghost" style={{ padding: '0.35rem 0.75rem' }} onClick={() => { setPayingId(p._id); setAmount(String(p.amount ?? '')); }}>
                            Collect payment
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)' }}>
        Payment report
      </h3>
      <p className="muted" style={{ marginBottom: '0.75rem' }}>
        Filter and review payment history.
      </p>
      <div className="toolbar" style={{ marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        {[
          { key: 'all', label: 'All' },
          { key: 'paid', label: 'Paid' },
          { key: 'unpaid', label: 'Unpaid' },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={reportFilter === key ? 'btn btn-primary' : 'btn btn-ghost'}
            style={{ padding: '0.35rem 0.85rem' }}
            onClick={() => {
              setReportFilter(key);
              setReportPage(1);
            }}
          >
            {label}
          </button>
        ))}
        <span className="muted" style={{ marginLeft: 'auto', fontSize: '0.9rem' }}>
          {reportMeta.total} record{reportMeta.total === 1 ? '' : 's'}
        </span>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Amount</th>
              <th>Charge</th>
              <th>Payment status</th>
              <th>Visit status</th>
              <th>Paid at</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {reportLoading ? (
              <tr>
                <td colSpan={8} className="empty-state">
                  Loading…
                </td>
              </tr>
            ) : reportItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-state">
                  No payments match this filter
                </td>
              </tr>
            ) : (
              reportItems.map((p) => {
                const v = p.visit;
                if (!v) return null;
                return (
                  <tr key={p._id}>
                    <td>{v.patient?.full_name}</td>
                    <td>{v.doctor?.fullName}</td>
                    <td>{Number(p.amount).toFixed(2)}</td>
                    <td style={{ fontSize: '0.88rem' }}>{chargeTypeLabel(p.charge_type)}</td>
                    <td>
                      <StatusBadge type="payment" value={p.status} />
                    </td>
                    <td>
                      <StatusBadge type="visit" value={v.visit_status} />
                    </td>
                    <td className="muted">{formatDateTime(p.paid_at)}</td>
                    <td>
                      <Link to={`/visits/${v._id}`}>Visit</Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {reportMeta.pages > 1 ? (
        <div className="toolbar" style={{ marginTop: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={reportPage <= 1}
            onClick={() => setReportPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span className="muted" style={{ padding: '0 0.5rem' }}>
            Page {reportPage} of {reportMeta.pages}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={reportPage >= reportMeta.pages}
            onClick={() => setReportPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </>
  );
}

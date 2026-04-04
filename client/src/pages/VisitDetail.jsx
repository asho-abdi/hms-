import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { VisitClinicalForms } from '../components/VisitClinicalForms.jsx';

export function VisitDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/visits/${id}`);
      setData(res);
    } catch {
      toast.error('Visit not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading || !data) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  const { visit, payment } = data;

  return (
    <>
      <div className="toolbar no-print">
        <Link to="/visits">← Back to visits</Link>
        <div className="toolbar-spacer" />
        <Link to={`/patients/${visit.patient?._id || visit.patient}/report`} className="btn btn-ghost">
          Full report
        </Link>
      </div>
      <h2 className="page-title">Visit</h2>

      <div className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <div className="muted">Patient</div>
            <strong>{visit.patient?.full_name}</strong>
          </div>
          <div>
            <div className="muted">Doctor</div>
            <strong>{visit.doctor?.fullName}</strong>
          </div>
          <div>
            <div className="muted">Payment</div>
            <StatusBadge type="payment" value={visit.payment_status} />
          </div>
          <div>
            <div className="muted">Visit status</div>
            <StatusBadge type="visit" value={visit.visit_status} />
          </div>
        </div>
        {payment && (
          <p className="muted">
            Billing amount: <strong>{payment.amount}</strong> · Payment record: {payment.status}
          </p>
        )}
      </div>

      <VisitClinicalForms visitId={id} adminDoctorId={null} onUpdated={load} omitSummaryCard />
    </>
  );
}

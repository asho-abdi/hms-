import { Fragment, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/client.js';
import { isDisplayableImageUrl } from '../../utils/mediaUrl.js';
import '../../styles/formal-report.css';

export function LabReportPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: res } = await api.get(`/lab/orders/${id}/report`);
        if (!cancelled) setData(res);
      } catch {
        toast.error('Could not load lab report');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const print = () => window.print();

  if (!data) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }
  const flagStyle = (flag) => {
    const f = String(flag || '').toUpperCase();
    if (f === 'HIGH' || f === 'LOW' || f === 'ABNORMAL') {
      return { color: '#b91c1c', fontWeight: 700 };
    }
    return {};
  };

  return (
    <>
      <div className="toolbar no-print" style={{ marginBottom: '1rem' }}>
        <Link to={`/lab/${id}`}>← Back</Link>
        <div className="toolbar-spacer" />
        <button type="button" className="btn btn-primary" onClick={print}>
          Print report
        </button>
      </div>

      <div className="formal-report print-root">
        <h1 className="formal-report__dept-title">{data.department_title}</h1>

        <div className="formal-report__meta">
          <div className="formal-report__meta-col">
            <div className="formal-report__meta-row">
              <strong>Patient Name</strong>
              <span>{data.patient_name}</span>
            </div>
            <div className="formal-report__meta-row">
              <strong>Patient ID</strong>
              <span>{data.patient_id}</span>
            </div>
            <div className="formal-report__meta-row">
              <strong>Age</strong>
              <span>{data.age != null ? data.age : '—'}</span>
            </div>
            <div className="formal-report__meta-row">
              <strong>Sex</strong>
              <span>{data.sex}</span>
            </div>
            <div className="formal-report__meta-row">
              <strong>Tel No</strong>
              <span>{data.tel}</span>
            </div>
          </div>
          <div className="formal-report__meta-col">
            <div className="formal-report__meta-row">
              <strong>Lab Ref No</strong>
              <span>{data.lab_ref_no}</span>
            </div>
            <div className="formal-report__meta-row">
              <strong>Report Date</strong>
              <span>{data.report_date}</span>
            </div>
            <div className="formal-report__meta-row">
              <strong>Report Time</strong>
              <span>{data.report_time}</span>
            </div>
            <div className="formal-report__meta-row">
              <strong>Doctor Name</strong>
              <span>{data.doctor_name}</span>
            </div>
            {data.priority && (
              <div className="formal-report__meta-row">
                <strong>Priority</strong>
                <span>{data.priority === 'URGENT' ? 'Urgent' : 'Normal'}</span>
              </div>
            )}
          </div>
        </div>

        <h2 className="formal-report__section-title">Lab Report</h2>

        <div className="formal-report__table-wrap">
          <table className="formal-report__table--lab">
            <thead>
              <tr>
                <th>Category</th>
                <th>Test Name</th>
                <th>Result</th>
                <th>N Range</th>
                <th>UOM</th>
              </tr>
            </thead>
            <tbody>
              {data.rows?.length ? (
                data.rows.map((row, i) => {
                  const imgUrl = row.image_url && String(row.image_url).trim();
                  const showImg = row.kind === 'imaging' && imgUrl && isDisplayableImageUrl(imgUrl);
                  return (
                    <Fragment key={i}>
                      <tr>
                        <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{row.category_name || '—'}</td>
                        <td>{row.test_name}</td>
                        <td style={{ fontFamily: 'var(--mono)', whiteSpace: 'pre-wrap', ...flagStyle(row.flag) }}>
                          {row.result}
                          {row.flag && row.flag !== 'NORMAL' && row.flag !== 'UNSET' ? (
                            <span style={{ marginLeft: '0.45rem', fontSize: '0.72rem' }}>({row.flag})</span>
                          ) : null}
                        </td>
                        <td style={{ whiteSpace: 'pre-wrap' }}>{row.n_range}</td>
                        <td>{row.uom}</td>
                      </tr>
                      {showImg ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', verticalAlign: 'top' }}>
                            <img src={imgUrl} alt="" style={{ maxHeight: '320px', maxWidth: '100%', objectFit: 'contain' }} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: '#64748b' }}>
                    No line items
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data.notes ? (
          <p className="muted" style={{ fontSize: '0.88rem' }}>
            <strong>Notes:</strong> {data.notes}
          </p>
        ) : null}

        <footer className="formal-report__lab-signature-block">
          <div className="formal-report__signature">
            <div className="formal-report__signature-box">
              <div className="formal-report__signature-line" aria-hidden />
              <div className="formal-report__signature-label">Authorized signature — Laboratory</div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

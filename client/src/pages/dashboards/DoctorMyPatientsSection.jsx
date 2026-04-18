import { Link } from 'react-router-dom';
import { formatPatientDt } from './DoctorPanelContent.jsx';

/**
 * Patient list table (shared by doctor overview / admin doctor panel and Full reports page).
 */
export function DoctorMyPatientsSection({
  myPatients,
  loading,
  patientsTitle = 'My patients',
  patientsIntro,
  /** Link text to the formal patient record document */
  reportLinkLabel = 'Medical record',
}) {
  const list = myPatients ?? [];

  return (
    <>
      <h2 className="page-title" style={{ marginTop: 0, marginBottom: '0.75rem' }}>
        {patientsTitle}
      </h2>
      <p className="muted" style={{ marginBottom: '1rem' }}>
        {patientsIntro}
      </p>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Phone</th>
              <th>Visits with you</th>
              <th>Completed visits</th>
              <th>Last seen</th>
              <th style={{ textAlign: 'right' }}>Report</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  Loading…
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  No patients yet.
                </td>
              </tr>
            ) : (
              list.map((row) => (
                <tr key={row.patient._id}>
                  <td>
                    <strong>{row.patient.full_name}</strong>
                  </td>
                  <td>{row.patient.phone || '—'}</td>
                  <td>{row.visit_count}</td>
                  <td>{row.completed_visit_count}</td>
                  <td>{formatPatientDt(row.last_visit_at)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Link to={`/patients/${row.patient._id}/report`} className="btn btn-ghost">
                      {reportLinkLabel}
                    </Link>
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

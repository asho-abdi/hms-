import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { VisitClinicalForms } from '../../components/VisitClinicalForms.jsx';

export function formatPatientDt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}

/** Same copy as the doctor home dashboard (admin panel reuses when viewing as a doctor). */
export const DOCTOR_DASHBOARD_INTRO =
  'Paid visits waiting for clinical work appear in your queue. Below is every patient you have a visit with, with a link to their full medical report (visit history and labs).';

export const DOCTOR_DASHBOARD_PATIENTS_INTRO =
  'Everyone you have a visit with is listed here. Open the full medical report for visit history and lab results.';

/**
 * Shared doctor queue + patient list UI (used by doctor home and admin doctor panel).
 */
export function DoctorPanelContent({
  queueCount,
  myPatients,
  loading,
  visitQueueHref,
  visitQueueDisabled,
  intro,
  patientsTitle = 'My patients',
  patientsIntro,
  header = null,
  queueItems = null,
  adminDoctorId = null,
  onClinicalRefresh,
  initialVisitId = null,
  /** Loaded completed visits for this doctor (same shape as queue items); null while not fetched */
  completedVisitItems = null,
}) {
  const [searchParams] = useSearchParams();
  const visitFromUrl = searchParams.get('visit');
  const preferredVisitId = (visitFromUrl || initialVisitId || '').trim();

  const list = myPatients ?? [];
  const [selectedVisitId, setSelectedVisitId] = useState('');
  const completedList = completedVisitItems ?? [];
  const clinicalReady = queueItems !== null && completedVisitItems !== null;
  const initialVisitAppliedRef = useRef(false);

  useEffect(() => {
    initialVisitAppliedRef.current = false;
  }, [preferredVisitId]);

  useEffect(() => {
    if (queueItems === null || completedVisitItems === null) return;

    const inQueue = (id) => id && queueItems.some((v) => String(v._id) === String(id));
    const inCompleted = (id) => id && completedList.some((v) => String(v._id) === String(id));

    if (preferredVisitId && !initialVisitAppliedRef.current) {
      const id = String(preferredVisitId);
      initialVisitAppliedRef.current = true;
      setSelectedVisitId(id);
      return;
    }

    if (!queueItems.length && !completedList.length) {
      if (!preferredVisitId) setSelectedVisitId('');
      return;
    }

    setSelectedVisitId((prev) => (prev && (inQueue(prev) || inCompleted(prev)) ? prev : ''));
  }, [queueItems, completedVisitItems, completedList, preferredVisitId]);

  return (
    <>
      {header}
      <p className="muted" style={{ marginBottom: '1.25rem' }}>
        {intro}
      </p>
      <div className="grid-2">
        <div className="stat-card">
          <div className="value">{queueCount ?? '—'}</div>
          <div className="label">Active queue</div>
        </div>
        <div className="stat-card">
          <div className="value">{loading ? '—' : list.length}</div>
          <div className="label">Patients on file</div>
        </div>
      </div>
      <div className="card" style={{ marginTop: '1.25rem' }}>
        {visitQueueDisabled ? (
          <button type="button" className="btn btn-primary" disabled>
            Open visit queue
          </button>
        ) : (
          <Link to={visitQueueHref} className="btn btn-primary">
            Open visit queue
          </Link>
        )}
      </div>

      <h2 className="page-title" style={{ marginTop: '2rem', marginBottom: '0.75rem' }}>
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
                  No patients yet — visits you take will appear here.
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
                      Full report
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {clinicalReady && (
        <>
          <h2 className="page-title" style={{ marginTop: '2.25rem', marginBottom: '0.75rem' }}>
            Clinical workspace
          </h2>
          <p className="muted" style={{ marginBottom: '1rem' }}>
            Pick an active visit to work the encounter, or a completed visit to reopen it and correct prescription, notes,
            or lab steps — then complete again when done.
          </p>
          <div className="card">
            <div className="form-row" style={{ marginBottom: 0, maxWidth: 560 }}>
              <label htmlFor="doctor-panel-visit">Visit</label>
              <select
                id="doctor-panel-visit"
                className="select"
                value={selectedVisitId}
                onChange={(e) => setSelectedVisitId(e.target.value)}
              >
                <option value="">Select…</option>
                {selectedVisitId &&
                !queueItems.some((v) => String(v._id) === String(selectedVisitId)) &&
                !completedList.some((v) => String(v._id) === String(selectedVisitId)) ? (
                  <option value={selectedVisitId}>Open visit (from link)</option>
                ) : null}
                {queueItems.length > 0 ? (
                  <optgroup label="Active queue">
                    {queueItems.map((v) => {
                      const vid = String(v._id);
                      return (
                        <option key={vid} value={vid}>
                          {v.patient?.full_name || 'Patient'} · {new Date(v.createdAt).toLocaleString()}
                        </option>
                      );
                    })}
                  </optgroup>
                ) : null}
                {completedList.length > 0 ? (
                  <optgroup label="Completed — reopen to edit">
                    {completedList.map((v) => {
                      const vid = String(v._id);
                      return (
                        <option key={vid} value={vid}>
                          {v.patient?.full_name || 'Patient'} · completed {new Date(v.updatedAt).toLocaleString()}
                        </option>
                      );
                    })}
                  </optgroup>
                ) : null}
              </select>
            </div>
            {!queueItems.length && !completedList.length ? (
              <p className="muted" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                No active or recent completed visits — open the visit queue when patients are waiting.
              </p>
            ) : null}
          </div>
          {selectedVisitId ? (
            <VisitClinicalForms
              visitId={selectedVisitId}
              adminDoctorId={adminDoctorId}
              onUpdated={onClinicalRefresh}
            />
          ) : null}
        </>
      )}
    </>
  );
}

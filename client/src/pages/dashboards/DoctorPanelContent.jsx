import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { VisitClinicalForms } from '../../components/VisitClinicalForms.jsx';
import { DoctorMyPatientsSection } from './DoctorMyPatientsSection.jsx';

export function formatPatientDt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}

/** Same copy as the doctor home dashboard (admin panel reuses when viewing as a doctor). */
export const DOCTOR_DASHBOARD_INTRO =
  'Active paid visits appear in your queue.';

export const DOCTOR_DASHBOARD_PATIENTS_INTRO =
  'Patients with at least one visit with you.';

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
  /** Doctor home: patient list lives on /dashboard/doctor/full-reports instead */
  hideMyPatientsSection = false,
}) {
  const [searchParams] = useSearchParams();
  const visitFromUrl = searchParams.get('visit');
  const preferredVisitId = (visitFromUrl || initialVisitId || '').trim();

  const list = myPatients ?? [];
  const [selectedVisitId, setSelectedVisitId] = useState('');
  const [visitQuery, setVisitQuery] = useState('');
  const [visitOpen, setVisitOpen] = useState(false);
  const visitComboboxRef = useRef(null);
  const completedList = completedVisitItems ?? [];
  const clinicalReady = queueItems !== null && completedVisitItems !== null;
  const initialVisitAppliedRef = useRef(false);

  const visitOptions = useMemo(() => {
    const active = (queueItems ?? []).map((v) => ({
      id: String(v._id),
      group: 'active',
      label: `${v.patient?.full_name || 'Patient'} · ${new Date(v.createdAt).toLocaleString()}`,
    }));
    const done = (completedList ?? []).map((v) => ({
      id: String(v._id),
      group: 'completed',
      label: `${v.patient?.full_name || 'Patient'} · completed ${new Date(v.updatedAt).toLocaleString()}`,
    }));
    return [...active, ...done];
  }, [queueItems, completedList]);

  const filteredVisitOptions = useMemo(() => {
    const q = visitQuery.trim().toLowerCase();
    if (!q) return visitOptions;
    return visitOptions.filter((o) => o.label.toLowerCase().includes(q));
  }, [visitOptions, visitQuery]);

  const filteredActiveVisits = useMemo(
    () => filteredVisitOptions.filter((o) => o.group === 'active'),
    [filteredVisitOptions]
  );
  const filteredCompletedVisits = useMemo(
    () => filteredVisitOptions.filter((o) => o.group === 'completed'),
    [filteredVisitOptions]
  );

  const pickVisit = (o) => {
    setSelectedVisitId(o.id);
    setVisitQuery(o.label);
    setVisitOpen(false);
  };

  useEffect(() => {
    const onDocDown = (e) => {
      if (!visitComboboxRef.current?.contains(e.target)) setVisitOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

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

  useEffect(() => {
    if (!selectedVisitId) return;
    const opt = visitOptions.find((o) => o.id === String(selectedVisitId));
    if (opt) setVisitQuery(opt.label);
    else setVisitQuery('Open visit (from link)');
  }, [selectedVisitId, visitOptions]);

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
      <div
        className="card"
        style={{
          marginTop: '1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
        }}
      >
        {visitQueueDisabled ? (
          <button type="button" className="btn btn-primary" disabled>
            Open visit queue
          </button>
        ) : (
          <Link to={visitQueueHref} className="btn btn-primary">
            Open visit queue
          </Link>
        )}
        {hideMyPatientsSection && !adminDoctorId ? (
          <Link to="/dashboard/doctor/full-reports" className="btn btn-ghost">
            Full reports
          </Link>
        ) : null}
      </div>

      {!hideMyPatientsSection ? (
        <div style={{ marginTop: '2rem' }}>
          <DoctorMyPatientsSection
            myPatients={myPatients}
            loading={loading}
            patientsTitle={patientsTitle}
            patientsIntro={patientsIntro}
            reportLinkLabel="Medical record"
          />
        </div>
      ) : null}

      {clinicalReady && (
        <>
          <h2 className="page-title" style={{ marginTop: '2.25rem', marginBottom: '0.75rem' }}>
            Clinical workspace
          </h2>
          <p className="muted" style={{ marginBottom: '1rem' }}>
            Select a visit to continue clinical work.
          </p>
          <div className="card card--overflow-visible">
            <div className="form-row" style={{ marginBottom: 0, maxWidth: 560 }} ref={visitComboboxRef}>
              <label htmlFor="doctor-panel-visit">Visit</label>
              <div className="patient-combobox">
                <input
                  id="doctor-panel-visit"
                  className="input"
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-expanded={visitOpen}
                  role="combobox"
                  value={visitQuery}
                  onChange={(e) => {
                    setVisitQuery(e.target.value);
                    setSelectedVisitId('');
                  }}
                  onFocus={() => setVisitOpen(true)}
                  placeholder="Search by patient name or date…"
                />
                {visitOpen && (filteredActiveVisits.length > 0 || filteredCompletedVisits.length > 0) ? (
                  <ul className="patient-combobox__list" role="listbox" aria-label="Visits">
                    {filteredActiveVisits.length > 0 ? (
                      <>
                        <li
                          role="presentation"
                          className="muted"
                          style={{
                            padding: '0.35rem 0.75rem 0.2rem',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            listStyle: 'none',
                          }}
                        >
                          Active queue
                        </li>
                        {filteredActiveVisits.map((o) => (
                          <li key={o.id} role="presentation">
                            <button
                              type="button"
                              className="patient-combobox__option"
                              role="option"
                              aria-selected={selectedVisitId === o.id}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => pickVisit(o)}
                            >
                              {o.label}
                            </button>
                          </li>
                        ))}
                      </>
                    ) : null}
                    {filteredCompletedVisits.length > 0 ? (
                      <>
                        <li
                          role="presentation"
                          className="muted"
                          style={{
                            padding: '0.45rem 0.75rem 0.2rem',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            listStyle: 'none',
                          }}
                        >
                          Completed — reopen to edit
                        </li>
                        {filteredCompletedVisits.map((o) => (
                          <li key={o.id} role="presentation">
                            <button
                              type="button"
                              className="patient-combobox__option"
                              role="option"
                              aria-selected={selectedVisitId === o.id}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => pickVisit(o)}
                            >
                              {o.label}
                            </button>
                          </li>
                        ))}
                      </>
                    ) : null}
                  </ul>
                ) : null}
                {visitOpen && visitQuery.trim() && filteredVisitOptions.length === 0 && visitOptions.length > 0 ? (
                  <p className="patient-combobox__empty muted">No visits match your search.</p>
                ) : null}
                {visitOpen && visitOptions.length === 0 ? (
                  <p className="patient-combobox__empty muted">No visits in queue or recent completed list.</p>
                ) : null}
              </div>
            </div>
            {!queueItems.length && !completedList.length ? (
              <p className="muted" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                No visits available.
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

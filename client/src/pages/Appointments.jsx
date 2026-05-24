import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '../constants/roles.js';

function formatDt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}

/** YYYY-MM-DD in local timezone (avoids UTC off-by-one vs calendar). */
function todayISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Next whole hour as HH:mm for default time selection. */
function nextHourTime() {
  const t = new Date();
  t.setMinutes(0, 0, 0);
  t.setHours(t.getHours() + 1);
  const h = String(t.getHours()).padStart(2, '0');
  const m = String(t.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function combineLocalDateTimeToISO(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const local = new Date(`${dateStr}T${timeStr}`);
  if (Number.isNaN(local.getTime())) return null;
  return local.toISOString();
}

export function Appointments() {
  const { user } = useAuth();
  const canManage = user.role === ROLES.ADMIN || user.role === ROLES.RECEPTIONIST;

  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [today, setToday] = useState([]);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    patient: '',
    doctor: '',
    notes: '',
  });
  const [patientQuery, setPatientQuery] = useState('');
  const [patientOpen, setPatientOpen] = useState(false);
  const patientComboboxRef = useRef(null);
  const [doctorQuery, setDoctorQuery] = useState('');
  const [doctorOpen, setDoctorOpen] = useState(false);
  const doctorComboboxRef = useRef(null);
  /** Separate fields so the browser shows a clear calendar + clock UI */
  const [apptDate, setApptDate] = useState(todayISODate);
  const [apptTime, setApptTime] = useState(nextHourTime);

  useEffect(() => {
    const onDocDown = (e) => {
      const inPatient = patientComboboxRef.current?.contains(e.target);
      const inDoctor = doctorComboboxRef.current?.contains(e.target);
      if (!inPatient) setPatientOpen(false);
      if (!inDoctor) setDoctorOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  const filteredPatients = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    let list = patients;
    if (q) {
      list = patients.filter((p) => {
        const name = (p.full_name || '').toLowerCase();
        const phone = String(p.phone || '').replace(/\D/g, '');
        return name.includes(q) || (digits.length > 0 && phone.includes(digits));
      });
    } else {
      list = [...patients].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    }
    return list.slice(0, 60);
  }, [patients, patientQuery]);

  const filteredDoctors = useMemo(() => {
    const q = doctorQuery.trim().toLowerCase();
    let list = doctors;
    if (q) {
      list = doctors.filter((d) => {
        const name = (d.fullName || '').toLowerCase();
        const email = (d.email || '').toLowerCase();
        const spec = (d.speciality || '').toLowerCase();
        return name.includes(q) || email.includes(q) || spec.includes(q);
      });
    } else {
      list = [...doctors].sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
    }
    return list.slice(0, 60);
  }, [doctors, doctorQuery]);

  const loadLists = async () => {
    setLoading(true);
    try {
      const [t, all, docs, pts] = await Promise.all([
        api.get('/appointments/today'),
        api.get('/appointments', { params: { limit: 50 } }),
        api.get('/users/doctors'),
        api.get('/patients', { params: { limit: 500 } }),
      ]);
      setToday(t.data.items || []);
      setList(all.data.items || []);
      setDoctors(docs.data.items || []);
      setPatients(pts.data.items || []);
    } catch {
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLists();
  }, []);

  const pickPatient = (p) => {
    setForm((f) => ({ ...f, patient: p._id }));
    setPatientQuery(p.full_name || '');
    setPatientOpen(false);
  };

  const pickDoctor = (d) => {
    setForm((f) => ({ ...f, doctor: d._id }));
    const spec = (d.speciality || '').trim();
    setDoctorQuery(spec ? `${d.fullName} — ${spec}` : d.fullName || '');
    setDoctorOpen(false);
  };

  const createAppt = async (e) => {
    e.preventDefault();
    if (!form.patient) {
      toast.error('Choose a patient from the search list');
      return;
    }
    if (!form.doctor) {
      toast.error('Choose a doctor from the search list');
      return;
    }
    const date_time = combineLocalDateTimeToISO(apptDate, apptTime);
    if (!date_time) {
      toast.error('Please choose a valid date and time');
      return;
    }
    try {
      await api.post('/appointments', {
        patient: form.patient,
        doctor: form.doctor,
        date_time,
        notes: form.notes,
      });
      toast.success('Appointment created — patient is on Visits and Payments');
      setForm({ patient: '', doctor: '', notes: '' });
      setPatientQuery('');
      setPatientOpen(false);
      setDoctorQuery('');
      setDoctorOpen(false);
      setApptDate(todayISODate());
      setApptTime(nextHourTime());
      loadLists();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create');
    }
  };

  const checkIn = async (id) => {
    try {
      await api.post(`/appointments/${id}/check-in`);
      toast.success('Patient checked in');
      loadLists();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Check-in failed');
    }
  };

  return (
    <>
      <h2 className="page-title">Appointments</h2>
      {canManage && (
        <div className="card appt-new-card" style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>New appointment</h2>
          <form onSubmit={createAppt}>
            <div className="appt-form-grid">
              <div className="form-row" style={{ marginBottom: 0 }} ref={patientComboboxRef}>
                <label htmlFor="patient-search">Patient</label>
                <div className="patient-combobox">
                  <input
                    id="patient-search"
                    className="input"
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-expanded={patientOpen}
                    role="combobox"
                    value={patientQuery}
                    onChange={(e) => {
                      setPatientQuery(e.target.value);
                      setForm((f) => ({ ...f, patient: '' }));
                      setPatientOpen(true);
                    }}
                    onFocus={() => setPatientOpen(true)}
                    placeholder=""
                  />
                  <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.78rem' }}>
                    Search by name or phone, then pick a row.
                  </p>
                  {patientOpen && filteredPatients.length > 0 ? (
                    <ul className="patient-combobox__list" role="listbox" aria-label="Patients">
                      {filteredPatients.map((p) => (
                        <li key={p._id} role="presentation">
                          <button
                            type="button"
                            className="patient-combobox__option"
                            role="option"
                            aria-selected={form.patient === p._id}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pickPatient(p)}
                          >
                            <span>{p.full_name}</span>
                            {p.phone ? (
                              <span className="muted" style={{ fontSize: '0.85em' }}>
                                {p.phone}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {patientOpen && patientQuery.trim() && filteredPatients.length === 0 ? (
                    <p className="patient-combobox__empty muted">No patients match your search.</p>
                  ) : null}
                </div>
              </div>
              <div className="form-row" style={{ marginBottom: 0 }} ref={doctorComboboxRef}>
                <label htmlFor="doctor-search">Doctor</label>
                <div className="patient-combobox">
                  <input
                    id="doctor-search"
                    className="input"
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-expanded={doctorOpen}
                    role="combobox"
                    value={doctorQuery}
                    onChange={(e) => {
                      setDoctorQuery(e.target.value);
                      setForm((f) => ({ ...f, doctor: '' }));
                      setDoctorOpen(true);
                    }}
                    onFocus={() => setDoctorOpen(true)}
                    placeholder=""
                  />
                  <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.78rem' }}>
                    Search by name, speciality, or email, then pick a row.
                  </p>
                  {doctorOpen && filteredDoctors.length > 0 ? (
                    <ul className="patient-combobox__list" role="listbox" aria-label="Doctors">
                      {filteredDoctors.map((d) => {
                        const spec = (d.speciality || '').trim();
                        return (
                          <li key={d._id} role="presentation">
                            <button
                              type="button"
                              className="patient-combobox__option"
                              role="option"
                              aria-selected={form.doctor === d._id}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => pickDoctor(d)}
                            >
                              <span>{d.fullName}</span>
                              <span className="muted" style={{ fontSize: '0.85em' }}>
                                {spec || '—'}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  {doctorOpen && doctorQuery.trim() && filteredDoctors.length === 0 ? (
                    <p className="patient-combobox__empty muted">No doctors match your search.</p>
                  ) : null}
                </div>
              </div>
              <div className="form-row appt-datetime" style={{ marginBottom: 0 }}>
                <div className="appt-datetime-row">
                  <div>
                    <label htmlFor="appt-date" className="appt-sublabel">
                      Date
                    </label>
                    <input
                      id="appt-date"
                      className="input"
                      type="date"
                      required
                      min={todayISODate()}
                      value={apptDate}
                      onChange={(e) => setApptDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="appt-time" className="appt-sublabel">
                      Time
                    </label>
                    <input
                      id="appt-time"
                      className="input"
                      type="time"
                      required
                      step={300}
                      value={apptTime}
                      onChange={(e) => setApptTime(e.target.value)}
                    />
                  </div>
                </div>
                <p className="muted appt-datetime-hint">Click the calendar and clock icons in your browser to pick values.</p>
              </div>
            </div>
            <div className="form-row" style={{ marginTop: '0.5rem' }}>
              <label>Notes</label>
              <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Schedule
              </button>
            </div>
          </form>
        </div>
      )}

      <h2 style={{ marginBottom: '0.75rem' }}>Today (scheduled)</h2>
      <div className="table-wrap" style={{ marginBottom: '1.5rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Status</th>
              {canManage && <th />}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="empty-state">
                  Loading…
                </td>
              </tr>
            ) : today.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-state">
                  No scheduled appointments for today
                </td>
              </tr>
            ) : (
              today.map((a) => (
                <tr key={a._id}>
                  <td>{formatDt(a.date_time)}</td>
                  <td>{a.patient?.full_name}</td>
                  <td>{a.doctor?.fullName}</td>
                  <td>
                    <StatusBadge type="appointment" value={a.status} label={a.status} />
                  </td>
                  {canManage && (
                    <td style={{ textAlign: 'right' }}>
                      {a.status === 'SCHEDULED' && (
                        <button type="button" className="btn btn-primary" style={{ padding: '0.35rem 0.75rem' }} onClick={() => checkIn(a._id)}>
                          Check in
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginBottom: '0.75rem' }}>Recent</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={4} className="empty-state">
                  No appointments
                </td>
              </tr>
            ) : (
              list.map((a) => (
                <tr key={a._id}>
                  <td>{formatDt(a.date_time)}</td>
                  <td>{a.patient?.full_name}</td>
                  <td>{a.doctor?.fullName}</td>
                  <td>
                    <StatusBadge type="appointment" value={a.status} label={a.status} />
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

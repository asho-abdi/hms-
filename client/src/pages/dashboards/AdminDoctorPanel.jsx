import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/client.js';
import {
  DoctorPanelContent,
  DOCTOR_DASHBOARD_INTRO,
  DOCTOR_DASHBOARD_PATIENTS_INTRO,
} from './DoctorPanelContent.jsx';

export function AdminDoctorPanel() {
  const [searchParams] = useSearchParams();
  const doctorParam = searchParams.get('doctor');
  const visitFromQuery = searchParams.get('visit') || null;

  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [queueCount, setQueueCount] = useState(null);
  const [queueItems, setQueueItems] = useState(null);
  const [completedVisitItems, setCompletedVisitItems] = useState(null);
  const [myPatients, setMyPatients] = useState(null);
  const [loading, setLoading] = useState(false);
  const [panelRefresh, setPanelRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/users/doctors');
        const list = data.items || [];
        if (!cancelled) {
          setDoctors(list);
        }
      } catch {
        toast.error('Could not load doctors');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!doctors.length) return;
    if (doctorParam && doctors.some((d) => String(d._id) === doctorParam)) {
      setSelectedDoctorId(doctorParam);
      return;
    }
    setSelectedDoctorId((prev) => prev || String(doctors[0]._id));
  }, [doctors, doctorParam]);

  useEffect(() => {
    if (!selectedDoctorId) {
      setQueueCount(null);
      setQueueItems(null);
      setMyPatients(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setQueueCount(null);
    setQueueItems(null);
    setCompletedVisitItems(null);
    setMyPatients(null);
    (async () => {
      try {
        const [{ data: q }, { data: mp }, { data: rc }] = await Promise.all([
          api.get('/visits/doctor-queue', { params: { doctor: selectedDoctorId } }),
          api.get('/visits/my-patients', { params: { doctor: selectedDoctorId } }),
          api.get('/visits/recent-completed', { params: { doctor: selectedDoctorId } }),
        ]);
        if (!cancelled) {
          setQueueCount(q.items?.length ?? 0);
          setQueueItems(q.items || []);
          setCompletedVisitItems(rc.items || []);
          setMyPatients(mp.items || []);
        }
      } catch {
        if (!cancelled) {
          toast.error('Could not load doctor panel');
          setQueueCount(null);
          setQueueItems([]);
          setCompletedVisitItems([]);
          setMyPatients([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDoctorId, panelRefresh]);

  const doctorCard = (
    <div className="card" style={{ marginBottom: '1.25rem' }}>
      <div className="form-row" style={{ marginBottom: 0, maxWidth: 420 }}>
        <label htmlFor="admin-doctor-select">Doctor</label>
        <select
          id="admin-doctor-select"
          className="select"
          value={selectedDoctorId}
          onChange={(e) => setSelectedDoctorId(e.target.value)}
        >
          <option value="">Select…</option>
          {doctors.map((d) => (
            <option key={d._id} value={d._id}>
              {d.fullName}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  if (!selectedDoctorId) {
    return (
      <>
        {doctorCard}
        <p className="muted">Select a doctor to load the dashboard.</p>
      </>
    );
  }

  return (
    <DoctorPanelContent
      header={doctorCard}
      queueCount={queueCount}
      myPatients={myPatients}
      loading={loading || myPatients === null}
      visitQueueHref={`/dashboard/doctor-panel/queue?doctor=${encodeURIComponent(selectedDoctorId)}`}
      visitQueueDisabled={false}
      intro={DOCTOR_DASHBOARD_INTRO}
      patientsTitle="My patients"
      patientsIntro={DOCTOR_DASHBOARD_PATIENTS_INTRO}
      queueItems={queueItems}
      completedVisitItems={completedVisitItems}
      adminDoctorId={selectedDoctorId}
      onClinicalRefresh={() => setPanelRefresh((n) => n + 1)}
      initialVisitId={visitFromQuery}
    />
  );
}

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/client.js';
import {
  DoctorPanelContent,
  DOCTOR_DASHBOARD_INTRO,
  DOCTOR_DASHBOARD_PATIENTS_INTRO,
} from './DoctorPanelContent.jsx';

export function DoctorDashboard() {
  const [searchParams] = useSearchParams();
  const visitFromQuery = searchParams.get('visit') || null;

  const [queueCount, setQueueCount] = useState(null);
  const [queueItems, setQueueItems] = useState(null);
  const [completedVisitItems, setCompletedVisitItems] = useState(null);
  const [myPatients, setMyPatients] = useState(null);
  const [panelRefresh, setPanelRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ data: q }, { data: mp }, { data: rc }] = await Promise.all([
          api.get('/visits/doctor-queue'),
          api.get('/visits/my-patients'),
          api.get('/visits/recent-completed'),
        ]);
        if (!cancelled) {
          setQueueCount(q.items?.length ?? 0);
          setQueueItems(q.items || []);
          setCompletedVisitItems(rc.items || []);
          setMyPatients(mp.items || []);
        }
      } catch {
        if (!cancelled) {
          toast.error('Could not load dashboard');
          setQueueItems([]);
          setCompletedVisitItems([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [panelRefresh]);

  return (
    <DoctorPanelContent
      queueCount={queueCount}
      myPatients={myPatients}
      loading={myPatients === null}
      visitQueueHref="/visits"
      visitQueueDisabled={false}
      intro={DOCTOR_DASHBOARD_INTRO}
      patientsTitle="My patients"
      patientsIntro={DOCTOR_DASHBOARD_PATIENTS_INTRO}
      queueItems={queueItems}
      completedVisitItems={completedVisitItems}
      adminDoctorId={null}
      onClinicalRefresh={() => setPanelRefresh((n) => n + 1)}
      initialVisitId={visitFromQuery}
    />
  );
}

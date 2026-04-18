import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/client.js';
import { DoctorMyPatientsSection } from './DoctorMyPatientsSection.jsx';
import { DOCTOR_DASHBOARD_PATIENTS_INTRO } from './DoctorPanelContent.jsx';

/**
 * My patients list — rendered inside DashboardLayout so the main HMS sidebar stays visible.
 */
export function DoctorFullReportsPage() {
  const [myPatients, setMyPatients] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/visits/my-patients');
        if (!cancelled) setMyPatients(data.items || []);
      } catch {
        toast.error('Could not load patients');
        if (!cancelled) setMyPatients([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = myPatients === null;

  return (
    <DoctorMyPatientsSection
      myPatients={myPatients}
      loading={loading}
      patientsTitle="My patients"
      patientsIntro={DOCTOR_DASHBOARD_PATIENTS_INTRO}
      reportLinkLabel="Medical record"
    />
  );
}

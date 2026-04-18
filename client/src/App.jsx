import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { DashboardLayout } from './components/DashboardLayout.jsx';
import { ROLES } from './constants/roles.js';
import { Login } from './pages/Login.jsx';
import { AdminDashboard } from './pages/dashboards/AdminDashboard.jsx';
import { DoctorDashboard } from './pages/dashboards/DoctorDashboard.jsx';
import { DoctorFullReportsPage } from './pages/dashboards/DoctorFullReportsPage.jsx';
import { AdminDoctorPanel } from './pages/dashboards/AdminDoctorPanel.jsx';
import { ReceptionDashboard } from './pages/dashboards/ReceptionDashboard.jsx';
import { LabDashboard } from './pages/dashboards/LabDashboard.jsx';
import { Patients } from './pages/Patients.jsx';
import { PatientEdit } from './pages/PatientEdit.jsx';
import { Appointments } from './pages/Appointments.jsx';
import { VisitList } from './pages/VisitList.jsx';
import { VisitDetail } from './pages/VisitDetail.jsx';
import { Payments } from './pages/Payments.jsx';
import { LabRequestsPage } from './pages/lab/LabRequestsPage.jsx';
import { LabReportPage } from './pages/lab/LabReportPage.jsx';
import { LabOrderDetail } from './pages/LabOrderDetail.jsx';
import { PatientReport } from './pages/PatientReport.jsx';
import { AdminUsers } from './pages/AdminUsers.jsx';
import { useAuth, dashboardPathForRole } from './context/AuthContext.jsx';

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={dashboardPathForRole(user.role)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/dashboard/cashier" element={<Navigate to="/dashboard/reception" replace />} />

      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard/admin" element={<ProtectedRoute roles={[ROLES.ADMIN]}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/doctor-panel" element={<ProtectedRoute roles={[ROLES.ADMIN]}><AdminDoctorPanel /></ProtectedRoute>} />
        <Route
          path="/dashboard/doctor-panel/queue"
          element={
            <ProtectedRoute roles={[ROLES.ADMIN]}>
              <VisitList />
            </ProtectedRoute>
          }
        />
        <Route path="/dashboard/doctor" element={<ProtectedRoute roles={[ROLES.DOCTOR]}><DoctorDashboard /></ProtectedRoute>} />
        <Route
          path="/dashboard/doctor/full-reports"
          element={
            <ProtectedRoute roles={[ROLES.DOCTOR]}>
              <DoctorFullReportsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/dashboard/reception" element={<ProtectedRoute roles={[ROLES.RECEPTIONIST]}><ReceptionDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/lab" element={<ProtectedRoute roles={[ROLES.LAB]}><LabDashboard /></ProtectedRoute>} />

        <Route path="/patients" element={<ProtectedRoute roles={[ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR]}><Patients /></ProtectedRoute>} />
        <Route path="/patients/:id/edit" element={<ProtectedRoute roles={[ROLES.ADMIN, ROLES.RECEPTIONIST]}><PatientEdit /></ProtectedRoute>} />

        <Route path="/appointments" element={<ProtectedRoute roles={[ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR]}><Appointments /></ProtectedRoute>} />

        <Route
          path="/visits"
          element={
            <ProtectedRoute roles={[ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.LAB]}>
              <VisitList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/visits/:id"
          element={
            <ProtectedRoute roles={[ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.LAB]}>
              <VisitDetail />
            </ProtectedRoute>
          }
        />

        <Route path="/payments" element={<ProtectedRoute roles={[ROLES.ADMIN, ROLES.RECEPTIONIST]}><Payments /></ProtectedRoute>} />

        <Route path="/lab-requests" element={<ProtectedRoute roles={[ROLES.ADMIN, ROLES.DOCTOR, ROLES.LAB]}><LabRequestsPage /></ProtectedRoute>} />
        <Route
          path="/lab/:id/report"
          element={
            <ProtectedRoute roles={[ROLES.ADMIN, ROLES.DOCTOR, ROLES.LAB, ROLES.RECEPTIONIST]}>
              <LabReportPage />
            </ProtectedRoute>
          }
        />
        <Route path="/lab/:id" element={<ProtectedRoute roles={[ROLES.ADMIN, ROLES.LAB, ROLES.DOCTOR]}><LabOrderDetail /></ProtectedRoute>} />
        <Route path="/lab" element={<Navigate to="/lab-requests" replace />} />

        <Route path="/admin/users" element={<ProtectedRoute roles={[ROLES.ADMIN]}><AdminUsers /></ProtectedRoute>} />
      </Route>

      <Route
        path="/patients/:id/report"
        element={
          <ProtectedRoute roles={[ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.LAB]}>
            <PatientReport />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  ClipboardList,
  UserCog,
  Wallet,
  FlaskConical,
  ShieldCheck,
  Stethoscope,
  FileText,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth, dashboardPathForRole } from '../context/AuthContext.jsx';
import { ROLES } from '../constants/roles.js';

function section(label) {
  return { kind: 'section', label };
}

function navForRole(role) {
  const overview = {
    kind: 'link',
    to: dashboardPathForRole(role),
    label: 'Overview',
    end: true,
    icon: LayoutDashboard,
  };

  if (role === ROLES.ADMIN) {
    return [
      overview,
      section('Reception'),
      { kind: 'link', to: '/patients', label: 'Patients', icon: Users },
      { kind: 'link', to: '/appointments', label: 'Appointments', icon: CalendarDays },
      { kind: 'link', to: '/visits', label: 'Visits', icon: ClipboardList },
      { kind: 'link', to: '/payments', label: 'Payments & billing', icon: Wallet },
      section('Doctor'),
      { kind: 'link', to: '/dashboard/doctor-panel', label: 'Doctor panel', icon: UserCog, end: false },
      section('Laboratory'),
      { kind: 'link', to: '/lab-requests', label: 'Lab requests', icon: FlaskConical },
      section('Administration'),
      { kind: 'link', to: '/admin/users', label: 'Staff users', icon: ShieldCheck },
    ];
  }
  if (role === ROLES.RECEPTIONIST) {
    return [
      overview,
      { kind: 'link', to: '/patients', label: 'Patients', icon: Users },
      { kind: 'link', to: '/appointments', label: 'Appointments', icon: CalendarDays },
      { kind: 'link', to: '/visits', label: 'Visits', icon: ClipboardList },
      { kind: 'link', to: '/payments', label: 'Payments & billing', icon: Wallet },
    ];
  }
  if (role === ROLES.DOCTOR) {
    return [
      overview,
      { kind: 'link', to: '/dashboard/doctor/full-reports', label: 'Full reports', icon: FileText, end: true },
      { kind: 'link', to: '/visits', label: 'My queue', icon: Stethoscope },
      { kind: 'link', to: '/lab-requests', label: 'Lab requests', icon: FlaskConical },
    ];
  }
  if (role === ROLES.LAB) {
    return [overview, { kind: 'link', to: '/lab-requests', label: 'Lab requests', icon: FlaskConical }];
  }
  return [overview];
}

const SIDEBAR_COLLAPSED_KEY = 'hms_sidebar_collapsed';

const TITLES = {
  '/dashboard/admin': 'Overview',
  '/dashboard/doctor-panel': 'Doctor panel',
  '/dashboard/doctor-panel/queue': 'Visit queue',
  '/dashboard/doctor': 'Doctor',
  '/dashboard/doctor/full-reports': 'Full reports',
  '/dashboard/reception': 'Reception',
  '/dashboard/lab': 'Laboratory',
  '/patients': 'Patients',
  '/patients/:id/edit': 'Edit patient',
  '/patients/:id/report': 'Patient report',
  '/appointments': 'Appointments',
  '/visits': 'Visits',
  '/visits/:id': 'Visit details',
  '/payments': 'Payments & billing',
  '/lab-requests': 'Lab tests',
  '/lab/:id': 'Lab order',
  '/admin/users': 'Staff users',
};

function titleForPath(pathname) {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith('/dashboard/doctor-panel/queue')) return TITLES['/dashboard/doctor-panel/queue'];
  if (pathname.startsWith('/patients/') && pathname.endsWith('/report')) return 'Patient report';
  if (pathname.startsWith('/patients/') && pathname.endsWith('/edit')) return 'Edit patient';
  if (pathname.startsWith('/visits/')) return 'Visit details';
  if (pathname.startsWith('/lab/') && pathname.endsWith('/report')) return 'Lab report';
  if (pathname.startsWith('/lab/')) return 'Lab order';
  return 'Dashboard';
}

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const title = titleForPath(location.pathname);
  const links = navForRole(user.role);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className={`dashboard-shell${sidebarCollapsed ? ' dashboard-shell--sidebar-collapsed' : ''}`}>
      <aside className={`sidebar no-print${sidebarCollapsed ? ' sidebar--collapsed' : ''}`}>
        <div className="sidebar-header-row">
          <div className="sidebar-brand">
            <div className="sidebar-brand__mark" aria-hidden>
              <img src="/assets/logo.png" alt="" className="sidebar-brand__logo-image" />
            </div>
            <div className="sidebar-brand__text">
              <strong>SIU</strong>
              <span className="sidebar-brand__tagline">Somali International University Hospital</span>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-expanded={!sidebarCollapsed}
            aria-controls="sidebar-main-nav"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={20} strokeWidth={2} aria-hidden /> : <ChevronLeft size={20} strokeWidth={2} aria-hidden />}
            <span className="visually-hidden">{sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
          </button>
        </div>
        <nav id="sidebar-main-nav" className="sidebar-nav" aria-label="Main">
          {links.map((l) => {
            if (l.kind === 'section') {
              return (
                <div key={`section-${l.label}`} className="sidebar-nav__section">
                  {l.label}
                </div>
              );
            }
            const Icon = l.icon;
            return (
              <NavLink
                key={`link-${l.to}-${l.label}`}
                to={l.to}
                end={l.end}
                className={({ isActive }) => (isActive ? 'active' : '')}
                title={sidebarCollapsed ? l.label : undefined}
              >
                <Icon className="sidebar-nav__icon" size={18} strokeWidth={2} aria-hidden />
                <span className="sidebar-nav__label">{l.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="user-pill" title={`${user.fullName} — ${user.role.replace(/_/g, ' ')}`}>
            <span className="user-pill__avatar" aria-hidden>
              {(user.fullName && user.fullName.trim().charAt(0).toUpperCase()) || '?'}
            </span>
            <span className="user-pill__name">{user.fullName}</span>
            <span className="user-pill__role">{user.role.replace(/_/g, ' ')}</span>
          </div>
          <button
            type="button"
            className="btn btn-ghost sidebar-signout"
            onClick={handleLogout}
            title={sidebarCollapsed ? 'Sign out' : undefined}
          >
            <LogOut size={17} strokeWidth={2} aria-hidden />
            <span className="sidebar-signout__label">Sign out</span>
          </button>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar no-print">
          <div className="topbar__title-wrap">
            <h1>{title}</h1>
          </div>
        </header>
        <div className="content-padding print-root">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

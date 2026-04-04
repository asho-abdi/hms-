import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { HeartPulse, Mail, Lock, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth, dashboardPathForRole } from '../context/AuthContext.jsx';

export function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to={from || dashboardPathForRole(user.role)} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const u = await login(email.trim(), password);
      toast.success(`Welcome, ${u.fullName}`);
      navigate(from || dashboardPathForRole(u.role), { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-page__backdrop" aria-hidden />
      <div className="card login-card">
        <h1 className="visually-hidden">Sign in</h1>
        <div className="login-card__brand">
          <div className="login-card__logo" aria-hidden>
            <HeartPulse size={28} strokeWidth={2} />
          </div>
        </div>
        <form onSubmit={handleSubmit} aria-label="Sign in">
          <div className="form-row">
            <label htmlFor="email" className="label-with-icon">
              <Mail size={15} strokeWidth={2} aria-hidden />
              <span className="visually-hidden">Email</span>
            </label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="password" className="label-with-icon">
              <Lock size={15} strokeWidth={2} aria-hidden />
              <span className="visually-hidden">Password</span>
            </label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary login-submit" disabled={submitting} aria-busy={submitting}>
            <LogIn size={18} strokeWidth={2} aria-hidden />
            <span className="visually-hidden">{submitting ? 'Signing in' : 'Sign in'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client.js';
import { SearchInputWithLogo } from '../components/SearchInputWithLogo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '../constants/roles.js';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

export function Patients() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user.role === ROLES.DOCTOR) {
    return <Navigate to="/visits" replace />;
  }

  const canEdit = user.role === ROLES.ADMIN || user.role === ROLES.RECEPTIONIST;
  const canDelete = user.role === ROLES.ADMIN;

  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    gender: 'male',
    dob: '',
    address: '',
  });

  const load = async (p = page, q = search) => {
    setLoading(true);
    try {
      const { data } = await api.get('/patients', {
        params: { page: p, search: q || undefined },
      });
      setItems(data.items || []);
      setTotalPages(data.pages || 1);
      setPage(data.page || p);
    } catch {
      toast.error('Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional debounce via button
  }, []);

  const submitCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/patients', { ...form, dob: form.dob });
      toast.success('Patient registered — schedule an appointment to add them to Visits and Payments');
      setForm({ full_name: '', phone: '', gender: 'male', dob: '', address: '' });
      navigate('/appointments');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create patient');
    }
  };

  const [pendingDelete, setPendingDelete] = useState(null);

  const remove = async (id) => {
    try {
      await api.delete(`/patients/${id}`);
      toast.success('Patient deleted');
      setPendingDelete(null);
      load(page, search);
    } catch {
      toast.error('Delete failed');
    }
  };

  return (
    <>
      <h2 className="page-title">Patients</h2>
      {canEdit && (
        <div className="card card-stretch" style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Register patient</h2>
          <form onSubmit={submitCreate}>
            <div className="form-grid-full">
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>Full name</label>
                <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>Phone</label>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>Gender</label>
                <select className="select" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>Date of birth</label>
                <input className="input" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} required />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>Address</label>
                <input
                  className="input"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder=""
                  autoComplete="street-address"
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Save patient
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="toolbar">
        <SearchInputWithLogo
          type="search"
          placeholder=""
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(1, search)}
          aria-label="Search patients by name"
          autoComplete="off"
        />
        <button type="button" className="btn btn-ghost" onClick={() => load(1, search)}>
          <Search size={17} strokeWidth={2} aria-hidden />
          Search
        </button>
        <div className="toolbar-spacer" />
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Gender</th>
              <th>DOB</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="empty-state">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-state">
                  No patients found
                </td>
              </tr>
            ) : (
              items.map((p) => (
                <tr key={p._id}>
                  <td>{p.full_name}</td>
                  <td>{p.phone}</td>
                  <td>{p.gender}</td>
                  <td>{formatDate(p.dob)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Link to={`/patients/${p._id}/report`}>Report</Link>
                    {canEdit && (
                      <>
                        {' · '}
                        <Link to={`/patients/${p._id}/edit`}>Edit</Link>
                      </>
                    )}
                    {canDelete &&
                      (pendingDelete === p._id ? (
                        <>
                          {' · '}
                          <button type="button" className="link-btn" onClick={() => remove(p._id)}>
                            Confirm delete
                          </button>
                          {' · '}
                          <button type="button" className="link-btn" onClick={() => setPendingDelete(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          {' · '}
                          <button type="button" className="link-btn" style={{ color: 'var(--danger)' }} onClick={() => setPendingDelete(p._id)}>
                            Delete
                          </button>
                        </>
                      ))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="toolbar" style={{ marginTop: '1rem' }}>
          <button type="button" className="btn btn-ghost" disabled={page <= 1} onClick={() => load(page - 1, search)}>
            Previous
          </button>
          <span className="muted">
            Page {page} / {totalPages}
          </span>
          <button type="button" className="btn btn-ghost" disabled={page >= totalPages} onClick={() => load(page + 1, search)}>
            Next
          </button>
        </div>
      )}
    </>
  );
}

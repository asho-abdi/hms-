import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client.js';
import '../pages/dashboards/admin-overview.css';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}

/**
 * Filterable registered-patient table (same behaviour as former admin overview block).
 * Uses GET /patients with extended query params (reception, admin, doctor can read).
 */
export function RegisteredPatientsReport() {
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState(null);

  const [patientSearch, setPatientSearch] = useState('');
  const [patientGender, setPatientGender] = useState('');
  const [registeredFrom, setRegisteredFrom] = useState('');
  const [registeredTo, setRegisteredTo] = useState('');

  const [applied, setApplied] = useState({
    patientSearch: '',
    patientGender: '',
    registeredFrom: '',
    registeredTo: '',
    page: 1,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/patients', {
        params: {
          search: applied.patientSearch || undefined,
          gender: applied.patientGender || undefined,
          registeredFrom: applied.registeredFrom || undefined,
          registeredTo: applied.registeredTo || undefined,
          page: applied.page,
          limit: 25,
        },
      });
      setPatients({
        items: data.items || [],
        total: data.total ?? 0,
        page: data.page ?? 1,
        pages: data.pages ?? 1,
        limit: data.limit ?? 25,
      });
    } catch {
      toast.error('Could not load patients');
      setPatients(null);
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    load();
  }, [load]);

  const applyFilters = (e) => {
    e?.preventDefault();
    setApplied({
      patientSearch,
      patientGender,
      registeredFrom,
      registeredTo,
      page: 1,
    });
  };

  const resetFilters = () => {
    setPatientSearch('');
    setPatientGender('');
    setRegisteredFrom('');
    setRegisteredTo('');
    setApplied({
      patientSearch: '',
      patientGender: '',
      registeredFrom: '',
      registeredTo: '',
      page: 1,
    });
  };

  const goPage = (next) => {
    setApplied((prev) => ({ ...prev, page: next }));
  };

  return (
    <div className="card admin-report-card">
      <h2>
        <Users size={22} strokeWidth={2} aria-hidden style={{ opacity: 0.85 }} />
        Registered patients report
      </h2>
      <p className="muted" style={{ marginBottom: '1rem' }}>
        Filter and review registered patients.
      </p>

      <form className="admin-filter-bar" onSubmit={applyFilters}>
        <div className="form-row">
          <label htmlFor="rp-search">Search name or phone</label>
          <input
            id="rp-search"
            className="input"
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
            placeholder=""
            autoComplete="off"
          />
        </div>
        <div className="form-row form-row--narrow">
          <label htmlFor="rp-gender">Gender</label>
          <select id="rp-gender" className="select" value={patientGender} onChange={(e) => setPatientGender(e.target.value)}>
            <option value="">All</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div className="form-row form-row--narrow">
          <label htmlFor="rp-from">Registered from</label>
          <input id="rp-from" className="input" type="date" value={registeredFrom} onChange={(e) => setRegisteredFrom(e.target.value)} />
        </div>
        <div className="form-row form-row--narrow">
          <label htmlFor="rp-to">Registered to</label>
          <input id="rp-to" className="input" type="date" value={registeredTo} onChange={(e) => setRegisteredTo(e.target.value)} />
        </div>
        <div className="admin-filter-actions">
          <button type="submit" className="btn btn-primary">
            <Filter size={17} strokeWidth={2} aria-hidden />
            Apply
          </button>
          <button type="button" className="btn btn-ghost" onClick={resetFilters}>
            Reset
          </button>
        </div>
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Phone</th>
              <th>Gender</th>
              <th>DOB</th>
              <th>Registered</th>
              <th style={{ textAlign: 'right' }}>Report</th>
            </tr>
          </thead>
          <tbody>
            {loading && !patients ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  Loading…
                </td>
              </tr>
            ) : !patients?.items?.length ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  No patients match these filters.
                </td>
              </tr>
            ) : (
              patients.items.map((p) => (
                <tr key={p._id}>
                  <td>
                    <strong>{p.full_name}</strong>
                  </td>
                  <td>{p.phone || '—'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{p.gender || '—'}</td>
                  <td>{formatDate(p.dob)}</td>
                  <td>{formatDateTime(p.createdAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Link to={`/patients/${p._id}/report`} className="btn btn-ghost">
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {patients && patients.total > 0 && (
        <div className="admin-pagination">
          <span>
            {patients.items.length} shown · {patients.total} total
            {patients.pages > 1 ? ` · Page ${patients.page} of ${patients.pages}` : ''}
          </span>
          {patients.pages > 1 ? (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn btn-ghost" disabled={patients.page <= 1 || loading} onClick={() => goPage(patients.page - 1)}>
                Previous
              </button>
              <button type="button" className="btn btn-ghost" disabled={patients.page >= patients.pages || loading} onClick={() => goPage(patients.page + 1)}>
                Next
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

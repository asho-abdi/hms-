import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client.js';

export function PatientEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/patients/${id}`);
        if (!cancelled) {
          const g = data.gender === 'female' || data.gender === 'male' ? data.gender : 'male';
          setForm({
            full_name: data.full_name,
            phone: data.phone,
            gender: g,
            dob: data.dob ? new Date(data.dob).toISOString().slice(0, 10) : '',
            address: data.address || '',
          });
        }
      } catch {
        toast.error('Patient not found');
        navigate('/patients');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/patients/${id}`, { ...form, dob: form.dob });
      toast.success('Patient updated');
      navigate('/patients');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  if (!form) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      <h2 className="page-title">Edit patient</h2>
      <div className="card" style={{ maxWidth: 520 }}>
        <form onSubmit={save}>
          <div className="form-row">
            <label>Full name</label>
            <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          </div>
          <div className="form-row">
            <label>Phone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          </div>
          <div className="form-row">
            <label>Gender</label>
            <select className="select" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div className="form-row">
            <label>Date of birth</label>
            <input className="input" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} required />
          </div>
          <div className="form-row">
            <label>Address</label>
            <input
              className="input"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder=""
              autoComplete="street-address"
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Save
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/patients')}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

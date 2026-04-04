import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client.js';
import { ROLES } from '../constants/roles.js';
import { useAuth } from '../context/AuthContext.jsx';

const roleOptions = [ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST, ROLES.LAB];

const emptyEdit = {
  _id: '',
  fullName: '',
  email: '',
  role: ROLES.RECEPTIONIST,
  speciality: '',
  isActive: true,
  password: '',
};

export function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    role: ROLES.RECEPTIONIST,
    speciality: '',
    visitFee: '',
  });
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get('/admin/users');
      setItems(data.items || []);
    } catch {
      toast.error('Could not load users');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form };
      if (payload.role !== ROLES.DOCTOR) {
        delete payload.speciality;
        delete payload.visitFee;
      } else {
        payload.visitFee = payload.visitFee === '' ? 0 : Number(payload.visitFee);
      }
      await api.post('/admin/users', payload);
      toast.success('User created');
      setForm({
        email: '',
        password: '',
        fullName: '',
        role: ROLES.RECEPTIONIST,
        speciality: '',
        visitFee: '',
      });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const openEdit = (u) => {
    setEdit({
      _id: u._id,
      fullName: u.fullName,
      email: u.email,
      role: u.role,
      speciality: u.speciality || '',
      visitFee: u.visitFee != null ? String(u.visitFee) : '',
      isActive: u.isActive,
      password: '',
    });
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    try {
      const payload = {
        fullName: edit.fullName,
        email: edit.email,
        role: edit.role,
        isActive: edit.isActive,
      };
      if (edit.role === ROLES.DOCTOR) {
        payload.speciality = edit.speciality || '';
        payload.visitFee = edit.visitFee === '' ? 0 : Number(edit.visitFee);
      }
      if (edit.password && edit.password.length > 0) {
        payload.password = edit.password;
      }
      await api.patch(`/admin/users/${edit._id}`, payload);
      toast.success('User updated');
      setEdit(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const removeUser = async (u) => {
    const self = currentUser && String(currentUser.id) === String(u._id);
    if (self) {
      toast.error('You cannot remove your own account');
      return;
    }
    const ok = window.confirm(
      `Remove ${u.fullName}? Users linked to visits or lab work will be deactivated instead of deleted.`
    );
    if (!ok) return;
    try {
      const { data } = await api.delete(`/admin/users/${u._id}`);
      toast.success(data.message || 'Done');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <>
      <h2 className="page-title">Staff users</h2>
      <div className="card card-stretch" style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Create user</h2>
        <form onSubmit={submit}>
          <div className="form-grid-full">
            <div className="form-row" style={{ marginBottom: 0 }}>
              <label>Email</label>
              <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <label>Full name</label>
              <input className="input" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <label>Role</label>
              <select
                className="select"
                value={form.role}
                onChange={(e) => {
                  const r = e.target.value;
                  setForm({
                    ...form,
                    role: r,
                    speciality: r === ROLES.DOCTOR ? form.speciality : '',
                    visitFee: r === ROLES.DOCTOR ? form.visitFee : '',
                  });
                }}
              >
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            {form.role === ROLES.DOCTOR && (
              <>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label>Speciality</label>
                  <input
                    className="input"
                    value={form.speciality}
                    onChange={(e) => setForm({ ...form, speciality: e.target.value })}
                    placeholder=""
                  />
                </div>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label>Consultation fee (visit)</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.visitFee}
                    onChange={(e) => setForm({ ...form, visitFee: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </>
            )}
            <div className="form-row" style={{ marginBottom: 0 }}>
              <label>Password</label>
              <input className="input" type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Create
            </button>
          </div>
        </form>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Speciality</th>
              <th>Visit fee</th>
              <th>Active</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => {
              const isSelf = currentUser && String(currentUser.id) === String(u._id);
              return (
                <tr key={u._id}>
                  <td>{u.fullName}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.role === ROLES.DOCTOR ? u.speciality || '—' : '—'}</td>
                  <td>{u.role === ROLES.DOCTOR && u.visitFee != null ? Number(u.visitFee).toFixed(2) : '—'}</td>
                  <td>{u.isActive ? 'Yes' : 'No'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn btn-ghost" style={{ marginRight: '0.35rem' }} onClick={() => openEdit(u)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={isSelf}
                      title={isSelf ? 'Cannot remove your own account' : undefined}
                      onClick={() => removeUser(u)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {edit && (
        <div
          className="admin-user-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-user-title"
          onClick={() => setEdit(null)}
        >
          <div className="card admin-user-modal" onClick={(e) => e.stopPropagation()}>
            <h2 id="edit-user-title" style={{ marginBottom: '1rem' }}>
              Edit user
            </h2>
            <form onSubmit={saveEdit}>
              <div className="form-row">
                <label htmlFor="edit-fullName">Full name</label>
                <input
                  id="edit-fullName"
                  className="input"
                  required
                  value={edit.fullName}
                  onChange={(e) => setEdit({ ...edit, fullName: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label htmlFor="edit-email">Email</label>
                <input
                  id="edit-email"
                  className="input"
                  type="email"
                  required
                  value={edit.email}
                  onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label htmlFor="edit-role">Role</label>
                <select
                  id="edit-role"
                  className="select"
                  value={edit.role}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      role: e.target.value,
                      speciality: e.target.value === ROLES.DOCTOR ? edit.speciality : '',
                      visitFee: e.target.value === ROLES.DOCTOR ? edit.visitFee : '',
                    })
                  }
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              {edit.role === ROLES.DOCTOR && (
                <>
                  <div className="form-row">
                    <label htmlFor="edit-speciality">Speciality</label>
                    <input
                      id="edit-speciality"
                      className="input"
                      value={edit.speciality}
                      onChange={(e) => setEdit({ ...edit, speciality: e.target.value })}
                      placeholder=""
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor="edit-visitFee">Consultation fee (visit)</label>
                    <input
                      id="edit-visitFee"
                      className="input"
                      type="number"
                      min={0}
                      step={0.01}
                      value={edit.visitFee}
                      onChange={(e) => setEdit({ ...edit, visitFee: e.target.value })}
                    />
                  </div>
                </>
              )}
              <div className="form-row" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  id="edit-active"
                  type="checkbox"
                  checked={edit.isActive}
                  disabled={currentUser && String(currentUser.id) === String(edit._id)}
                  onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })}
                />
                <label htmlFor="edit-active" style={{ marginBottom: 0 }}>
                  Account active
                </label>
              </div>
              <div className="form-row">
                <label htmlFor="edit-password">New password (optional)</label>
                <input
                  id="edit-password"
                  className="input"
                  type="password"
                  minLength={6}
                  autoComplete="new-password"
                  placeholder=""
                  value={edit.password}
                  onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

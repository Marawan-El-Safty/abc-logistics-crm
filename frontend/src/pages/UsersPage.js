import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { PlusIcon } from '@heroicons/react/24/outline';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';

function UserForm({ initial, roles, onSave, onClose }) {
  const [form, setForm] = useState(initial || { fullName: '', email: '', password: '', roleId: 3, phone: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (initial?.id) {
        await api.put(`/users/${initial.id}`, form);
      } else {
        await api.post('/users', form);
      }
      onSave();
    } catch (err) { toast.error(err.response?.data?.error || 'Error saving user'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 form-group">
          <label className="label">Full Name *</label>
          <input className="input" required value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="label">Email *</label>
          <input className="input" type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
        </div>
        {!initial?.id && (
          <div className="col-span-2 form-group">
            <label className="label">Password *</label>
            <input className="input" type="password" required minLength={8} value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
          </div>
        )}
        <div className="form-group">
          <label className="label">Role *</label>
          <select className="select" value={form.roleId} onChange={e => setForm({...form, roleId: parseInt(e.target.value)})}>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        {initial?.id && (
          <div className="form-group flex items-center gap-2 mt-5">
            <input type="checkbox" id="isActive" checked={form.isActive !== false} onChange={e => setForm({...form, isActive: e.target.checked})} />
            <label htmlFor="isActive" className="text-slate-700 dark:text-gray-300 text-sm">Active</label>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 mt-4">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving...' : (initial?.id ? 'Update User' : 'Create User')}</button>
      </div>
    </form>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [deleteUserId, setDeleteUserId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([api.get('/users'), api.get('/users/roles')]);
      setUsers(usersRes.data.data || []);
      setRoles(rolesRes.data.data || []);
    } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async () => {
    try { await api.delete(`/users/${deleteUserId}`); load(); } catch (_) {}
  };

  const ROLE_BADGE = { 'Admin': 'badge-red', 'Sales Manager': 'badge-gold', 'Sales Rep': 'badge-blue', 'Finance': 'badge-green' };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">User Management</h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm">{users.length} users</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <PlusIcon className="w-4 h-4 inline mr-1.5" />Add User
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500 dark:text-gray-500">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map(u => (
            <div key={u.id} className="card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-gold-500 flex items-center justify-center text-navy-950 font-bold text-lg">
                  {u.full_name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-white truncate">{u.full_name}</div>
                  <div className="text-slate-500 dark:text-gray-400 text-sm truncate">{u.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className={`badge ${ROLE_BADGE[u.role_name] || 'badge-gray'}`}>{u.role_name}</span>
                {!u.is_active && <span className="badge-red">Inactive</span>}
              </div>
              {u.phone && <div className="text-slate-500 dark:text-gray-400 text-xs mb-2">{u.phone}</div>}
              {u.last_login_at && (
                <div className="text-slate-500 dark:text-gray-600 text-xs">Last login: {new Date(u.last_login_at).toLocaleDateString()}</div>
              )}
              <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-navy-700">
                <button
                  className="btn-secondary text-xs flex-1"
                  onClick={() => setEditUser({ id: u.id, fullName: u.full_name, email: u.email, phone: u.phone || '', roleId: u.role_id, isActive: u.is_active })}
                >
                  Edit
                </button>
                <button className="btn-danger text-xs" onClick={() => setDeleteUserId(u.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Add New User" size="md">
        <UserForm roles={roles} onSave={() => { setShowForm(false); load(); }} onClose={() => setShowForm(false)} />
      </Modal>
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title="Edit User" size="md">
        {editUser && (
          <UserForm initial={editUser} roles={roles} onSave={() => { setEditUser(null); load(); }} onClose={() => setEditUser(null)} />
        )}
      </Modal>
      <ConfirmDialog
        isOpen={!!deleteUserId}
        onClose={() => setDeleteUserId(null)}
        onConfirm={handleDelete}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        danger
      />
    </div>
  );
}

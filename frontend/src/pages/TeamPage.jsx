import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../store/AuthContext';
import { useRoles } from '../hooks/useRoles';
import toast from 'react-hot-toast';
import {
  UserPlusIcon, MagnifyingGlassIcon,
  NoSymbolIcon, CheckCircleIcon, TrashIcon, XMarkIcon,
} from '@heroicons/react/24/outline';

const ROLE_BADGE = {
  'Admin': 'bg-amber-100 text-amber-800 border-amber-200',
  'Sales Manager': 'bg-blue-100 text-blue-800 border-blue-200',
  'Sales Rep': 'bg-green-100 text-green-800 border-green-200',
  'Finance': 'bg-purple-100 text-purple-800 border-purple-200',
  'Operation': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'Viewer': 'bg-slate-100 text-slate-600 border-slate-200',
};

function SeatBar({ used, limit }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const danger = pct >= 90;
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all ${danger ? 'bg-red-500' : 'bg-amber-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-sm font-semibold ${danger ? 'text-red-600' : 'text-slate-700'}`}>
        {used} / {limit} seats
      </span>
    </div>
  );
}

function InviteModal({ onClose, onInvited, seatInfo }) {
  const { roles } = useRoles();
  const [form, setForm] = useState({ email: '', fullName: '', roleId: '', tenantRole: 'member' });
  const [saving, setSaving] = useState(false);

  const atLimit = seatInfo && seatInfo.used >= seatInfo.limit;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.roleId) return toast.error('Email and role are required');
    setSaving(true);
    try {
      await api.post('/users/invite', {
        email: form.email,
        fullName: form.fullName || undefined,
        roleId: parseInt(form.roleId),
        tenantRole: form.tenantRole,
      });
      toast.success(`Invite sent to ${form.email}`);
      onInvited();
      onClose();
    } catch (err) {
      if (err.response?.data?.error === 'seat_limit_reached') {
        toast.error('Seat limit reached. Upgrade your plan to add more users.');
      } else {
        toast.error(err.response?.data?.error || 'Failed to send invite');
      }
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">Invite Team Member</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {atLimit ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
              <NoSymbolIcon className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-slate-700 font-medium mb-1">Seat limit reached</p>
            <p className="text-sm text-slate-500">You've used all {seatInfo.limit} seats. Upgrade your plan to invite more users.</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email address *</label>
              <input
                type="email" required autoFocus
                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="colleague@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full name (optional)</label>
              <input
                type="text"
                value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CRM Role *</label>
              <select
                required value={form.roleId} onChange={e => setForm({ ...form, roleId: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="">Select a role…</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Workspace permission</label>
              <select
                value={form.tenantRole} onChange={e => setForm({ ...form, tenantRole: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="member">Member — standard access</option>
                <option value="admin">Admin — can manage users &amp; settings</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 disabled:opacity-60">
                {saving ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function UserRow({ u, currentUser, roles, onUpdate }) {
  const [roleId, setRoleId] = useState(u.role_id);
  const [saving, setSaving] = useState(false);
  const isMe = u.id === currentUser?.id;
  const isOwner = u.tenant_role === 'owner';

  const changeRole = async (newRoleId) => {
    setRoleId(newRoleId);
    setSaving(true);
    try {
      await api.put(`/users/${u.id}`, { roleId: parseInt(newRoleId) });
      toast.success('Role updated');
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update role');
      setRoleId(u.role_id);
    } finally { setSaving(false); }
  };

  const toggleActive = async () => {
    setSaving(true);
    try {
      await api.put(`/users/${u.id}`, { isActive: !u.is_active });
      toast.success(u.is_active ? 'User deactivated' : 'User reactivated');
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update user');
    } finally { setSaving(false); }
  };

  const removeUser = async () => {
    if (!window.confirm(`Remove ${u.full_name} from your workspace? They will lose all access.`)) return;
    setSaving(true);
    try {
      await api.delete(`/users/${u.id}/seat`);
      toast.success('User removed');
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove user');
    } finally { setSaving(false); }
  };

  const statusColor = {
    active: 'bg-green-100 text-green-700',
    pending: 'bg-amber-100 text-amber-700',
    inactive: 'bg-slate-100 text-slate-500',
  }[u.user_status] || 'bg-slate-100 text-slate-500';

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {u.full_name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              {u.full_name}
              {isMe && <span className="text-xs text-slate-400 font-normal">(you)</span>}
              {isOwner && <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold">OWNER</span>}
            </div>
            <div className="text-xs text-slate-500">{u.email}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {isOwner || isMe ? (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${ROLE_BADGE[u.role_name] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
            {u.role_name}
          </span>
        ) : (
          <select
            value={roleId} onChange={e => changeRole(e.target.value)}
            disabled={saving}
            className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
          >
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${statusColor}`}>
          {u.user_status}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">
        {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {!isOwner && !isMe && (
            <>
              <button
                onClick={toggleActive}
                disabled={saving}
                title={u.is_active ? 'Deactivate' : 'Reactivate'}
                className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${u.is_active ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'}`}
              >
                {u.is_active ? <NoSymbolIcon className="w-4 h-4" /> : <CheckCircleIcon className="w-4 h-4" />}
              </button>
              <button
                onClick={removeUser}
                disabled={saving}
                title="Remove from workspace"
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function TeamPage() {
  const { user: currentUser, canAdminTeam } = useAuth();
  const { roles } = useRoles();
  const [users, setUsers] = useState([]);
  const [seatInfo, setSeatInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);

  const load = useCallback(async () => {
    try {
      const [usersRes, seatsRes] = await Promise.all([
        api.get('/users'),
        api.get('/users/seats'),
      ]);
      setUsers(usersRes.data.data || []);
      setSeatInfo(seatsRes.data);
    } catch {
      toast.error('Failed to load team');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u =>
    !search ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.role_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Team Management</h2>
          <p className="text-sm text-slate-500 mt-0.5">Invite members, assign CRM roles, and manage workspace access.</p>
        </div>
        {canAdminTeam && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl font-medium text-sm hover:bg-amber-600 transition-colors shadow-sm"
          >
            <UserPlusIcon className="w-4 h-4" />
            Invite Member
          </button>
        )}
      </div>

      {seatInfo && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-700">Seat Usage</span>
            <span className="text-xs text-slate-500 capitalize">{seatInfo.plan} plan</span>
          </div>
          <SeatBar used={seatInfo.used} limit={seatInfo.limit} />
          {seatInfo.used >= seatInfo.limit && (
            <p className="mt-2 text-xs text-red-600">
              Seat limit reached. Remove inactive users or{' '}
              <a href="/pricing" className="underline font-medium">upgrade your plan</a>.
            </p>
          )}
        </div>
      )}

      <div className="relative">
        <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search" placeholder="Search by name, email, or role…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Member</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">CRM Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Login</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400 text-sm">
                  {search ? 'No users match your search.' : 'No team members yet.'}
                </td>
              </tr>
            ) : filtered.map(u => (
              <UserRow key={u.id} u={u} currentUser={currentUser} roles={roles} onUpdate={load} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">Role Permissions</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { name: 'Admin', desc: 'Full CRM access, user management, settings' },
            { name: 'Sales Manager', desc: 'Leads, quotations, reports, team oversight' },
            { name: 'Sales Rep', desc: 'Leads, quotations, emails, activities' },
            { name: 'Finance', desc: 'Invoices, bank accounts, profit view' },
            { name: 'Operation', desc: 'Operations, shipments, quotations' },
            { name: 'Viewer', desc: 'Read-only access to dashboard & reports' },
          ].map(r => (
            <div key={r.name} className="flex items-start gap-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border flex-shrink-0 mt-0.5 ${ROLE_BADGE[r.name] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                {r.name}
              </span>
              <span className="text-xs text-slate-500">{r.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {showInvite && (
        <InviteModal
          seatInfo={seatInfo}
          onClose={() => setShowInvite(false)}
          onInvited={load}
        />
      )}
    </div>
  );
}

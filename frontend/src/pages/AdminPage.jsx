import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../store/AuthContext';
import { useNavigate } from 'react-router-dom';

const STATUS_COLORS = { trial:'bg-yellow-100 text-yellow-700', active:'bg-green-100 text-green-700', suspended:'bg-red-100 text-red-700', canceled:'bg-gray-100 text-gray-600' };

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [patch, setPatch] = useState({});
  const [impersonating, setImpersonating] = useState(null);

  useEffect(() => {
    if (!user?.is_superadmin) { navigate('/dashboard'); return; }
    api.get('/admin/tenants').then(r => { setTenants(r.data.data); setLoading(false); }).catch(() => setLoading(false));
  }, [user, navigate]);

  const savePatch = async (id) => {
    await api.patch(`/admin/tenants/${id}`, patch);
    setEditing(null);
    const r = await api.get('/admin/tenants');
    setTenants(r.data.data);
  };

  const impersonate = async (id) => {
    try {
      const r = await api.post(`/admin/tenants/${id}/impersonate`);
      setImpersonating({ tenantId: id, token: r.data.accessToken });
      alert(`Impersonation token (15m): ${r.data.accessToken}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
  };

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Super Admin — Tenants</h1>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              {['Company','Slug','Plan','Status','Seats','Trial Ends','Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {tenants.map(t => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{t.company_name}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{t.slug}</td>
                <td className="px-4 py-3 text-gray-600 capitalize">{t.plan_name || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] || ''}`}>{t.status}</span>
                </td>
                <td className="px-4 py-3 text-gray-600">{t.seat_used}/{t.seat_limit}</td>
                <td className="px-4 py-3 text-gray-500">{t.trial_ends_at ? new Date(t.trial_ends_at).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={() => { setEditing(t.id); setPatch({ status: t.status, seat_limit: t.seat_limit }); }}
                    className="text-xs px-2 py-1 border rounded hover:bg-gray-100">Edit</button>
                  <button onClick={() => impersonate(t.id)}
                    className="text-xs px-2 py-1 border border-orange-300 text-orange-600 rounded hover:bg-orange-50">Impersonate</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80">
            <h2 className="font-semibold text-gray-800 mb-4">Edit Tenant</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600">Status</label>
                <select className="w-full border rounded px-2 py-1.5 text-sm mt-1"
                  value={patch.status} onChange={e => setPatch(p => ({ ...p, status: e.target.value }))}>
                  {['trial','active','suspended','canceled'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600">Seat Limit</label>
                <input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-1"
                  value={patch.seat_limit} onChange={e => setPatch(p => ({ ...p, seat_limit: parseInt(e.target.value) }))} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => savePatch(editing)} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Save</button>
              <button onClick={() => setEditing(null)} className="flex-1 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

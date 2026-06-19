import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { usePlan } from '../hooks/usePlan';

export default function TeamPage() {
  const [seats, setSeats] = useState(null);
  const [users, setUsers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { atLimit } = usePlan();

  const load = async () => {
    const [s, u] = await Promise.all([api.get('/users/seats'), api.get('/users')]);
    setSeats(s.data);
    setUsers(u.data.data || []);
  };

  useEffect(() => { load(); }, []);

  const invite = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await api.post('/users/invite', { email: inviteEmail });
      setSuccess(`Invite sent to ${inviteEmail}`);
      setInviteEmail('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send invite');
    }
  };

  const removeSeat = async (userId) => {
    if (!window.confirm('Remove this user from the team?')) return;
    try {
      await api.delete(`/users/${userId}/seat`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
  };

  const seatsFull = atLimit('seats');

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Team</h1>

      {seats && (
        <div className="mb-6 p-4 bg-blue-50 rounded-xl flex items-center gap-4">
          <div>
            <p className="text-sm text-blue-700 font-medium">Seats</p>
            <p className="text-2xl font-bold text-blue-900">{seats.used} / {seats.limit}</p>
          </div>
          <div className="ml-auto text-sm text-blue-600 capitalize">{seats.plan} plan</div>
        </div>
      )}

      {!seatsFull && (
        <form onSubmit={invite} className="flex gap-3 mb-8">
          <input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
            placeholder="colleague@company.com"
            className="flex-1 border rounded-lg px-3 py-2 text-sm" />
          <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Invite</button>
        </form>
      )}
      {seatsFull && (
        <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          Seat limit reached. <a href="/pricing" className="underline">Upgrade</a> to add more members.
        </div>
      )}
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {success && <p className="text-green-600 text-sm mb-4">{success}</p>}

      <div className="divide-y border rounded-xl overflow-hidden">
        {users.map(u => (
          <div key={u.id} className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-sm">
              {u.full_name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">{u.full_name}</p>
              <p className="text-xs text-gray-500">{u.email} · {u.role_name}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${u.user_status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
              {u.user_status || 'active'}
            </span>
            {u.role_name !== 'Admin' && (
              <button onClick={() => removeSeat(u.id)} className="text-red-500 hover:text-red-700 text-xs">Remove</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

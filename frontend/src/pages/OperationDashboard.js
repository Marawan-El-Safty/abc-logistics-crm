import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import api from '../services/api';
import {
  RocketLaunchIcon, TruckIcon, ExclamationTriangleIcon,
  PaperAirplaneIcon, PlusIcon, MapPinIcon, CalendarDaysIcon,
  CheckBadgeIcon, ClockIcon,
} from '@heroicons/react/24/outline';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';
const startOfWeek = () => {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
};

const StatCard = ({ icon: Icon, label, value, sub, color = 'gold', onClick }) => (
  <div
    className={`card flex items-center gap-4 ${onClick ? 'cursor-pointer hover:border-gold-500/50 transition-all' : ''}`}
    onClick={onClick}
  >
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
      ${color === 'gold' ? 'bg-gold-500/15 text-gold-400' :
        color === 'green' ? 'bg-green-500/15 text-green-400' :
        color === 'red' ? 'bg-red-500/15 text-red-400' :
        'bg-blue-500/15 text-blue-400'}`}>
      <Icon className="w-6 h-6" />
    </div>
    <div className="min-w-0">
      <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
      <div className="text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide">{label}</div>
      {sub && <div className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">{sub}</div>}
    </div>
  </div>
);

export default function OperationDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [confirmed, setConfirmed] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/quotations', { params: { status: 'Confirmed', limit: 200 } }),
      api.get('/quotations', { params: { status: 'Sent', limit: 200 } }),
    ])
      .then(([cRes, sRes]) => {
        setConfirmed(cRes.data.data || []);
        setSent(sRes.data.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-2 h-2 bg-gold-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );

  const weekStart = startOfWeek();
  const missingCarrier = confirmed.filter(b => !b.carrier);
  const confirmedThisWeek = confirmed.filter(b => new Date(b.confirmed_at || b.updated_at) >= weekStart);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <RocketLaunchIcon className="w-6 h-6 text-gold-500" />
            Good morning, {user?.fullName?.split(' ')[0]} 👋
          </h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm mt-0.5">Operations overview — vessel bookings</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => navigate('/shipping-rates')}>
            <TruckIcon className="w-4 h-4 inline mr-1.5" />Shipping Rates
          </button>
          <button className="btn-primary" onClick={() => navigate('/quotations/new')}>
            <PlusIcon className="w-4 h-4 inline mr-1.5" />New Quotation
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={CheckBadgeIcon} label="To Book" value={confirmed.length} color="gold"
          sub="confirmed by client" onClick={() => navigate('/operations')} />
        <StatCard icon={ExclamationTriangleIcon} label="Missing Carrier" value={missingCarrier.length}
          color={missingCarrier.length ? 'red' : 'green'} sub="need carrier set" onClick={() => navigate('/operations')} />
        <StatCard icon={CalendarDaysIcon} label="Confirmed This Week" value={confirmedThisWeek.length} color="green" />
        <StatCard icon={PaperAirplaneIcon} label="Awaiting Client" value={sent.length} color="blue"
          sub="sent, not yet confirmed" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bookings to act on */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title flex items-center gap-2">
              <RocketLaunchIcon className="w-4 h-4 text-gold-500" />
              Bookings to Reserve
            </h3>
            {confirmed.length > 0 && (
              <button onClick={() => navigate('/operations')} className="text-xs text-gold-600 dark:text-gold-400 hover:text-gold-500">
                View all →
              </button>
            )}
          </div>
          {confirmed.length === 0 ? (
            <div className="text-center py-10 text-slate-400 dark:text-gray-600 text-sm">
              <CheckBadgeIcon className="w-8 h-8 mx-auto mb-2 text-green-400/60" />
              No confirmed bookings waiting
            </div>
          ) : (
            <div className="space-y-2">
              {confirmed.slice(0, 6).map(b => (
                <div key={b.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-navy-800/50 hover:bg-slate-100 dark:hover:bg-navy-800 cursor-pointer transition-all"
                  onClick={() => navigate('/operations')}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gold-500">{b.reference_no}</span>
                      <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{b.client_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                      <MapPinIcon className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{b.origin} → {b.destination}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {b.carrier ? (
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900 dark:text-white">
                        <TruckIcon className="w-4 h-4 text-gold-500" />{b.carrier}
                      </span>
                    ) : (
                      <span className="text-xs text-red-500 font-medium">⚠ No carrier</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Awaiting client confirmation */}
        <div className="card">
          <h3 className="section-title mb-4 flex items-center gap-2">
            <ClockIcon className="w-4 h-4 text-blue-400" />
            Awaiting Client
          </h3>
          {sent.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-gray-600 text-sm">Nothing pending</div>
          ) : (
            <div className="space-y-2">
              {sent.slice(0, 7).map(s => (
                <div key={s.id}
                  className="p-2.5 rounded-lg bg-slate-50 dark:bg-navy-800/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-navy-800 transition-all"
                  onClick={() => navigate(`/quotations/${s.id}/edit`)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-gold-500">{s.reference_no}</span>
                    <span className="text-xs text-slate-400 dark:text-gray-600">{fmtDate(s.updated_at)}</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-gray-300 font-medium truncate mt-0.5">{s.client_name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate">{s.origin} → {s.destination}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

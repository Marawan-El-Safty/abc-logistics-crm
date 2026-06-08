import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import api from '../services/api';
import {
  CurrencyDollarIcon, ClockIcon, ExclamationTriangleIcon,
  CheckCircleIcon, BuildingLibraryIcon, PlusIcon, DocumentTextIcon,
} from '@heroicons/react/24/outline';
import Badge from '../components/common/Badge';

const fmt = (n, currency = 'USD') =>
  `${currency} ${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

// Sum {currency: total} map into a compact "USD 1,200 · EUR 800" string
function MoneyByCurrency({ map, empty = '—' }) {
  const entries = Object.entries(map).filter(([, v]) => v > 0);
  if (!entries.length) return <span>{empty}</span>;
  return (
    <div className="flex flex-col">
      {entries.map(([curr, total]) => (
        <span key={curr} className="leading-tight">{fmt(total, curr)}</span>
      ))}
    </div>
  );
}

const StatCard = ({ icon: Icon, label, children, sub, color = 'blue', onClick }) => (
  <div
    className={`card flex items-start gap-4 ${onClick ? 'cursor-pointer hover:border-gold-500/50 transition-all' : ''}`}
    onClick={onClick}
  >
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
      ${color === 'blue' ? 'bg-blue-500/15 text-blue-400' :
        color === 'green' ? 'bg-green-500/15 text-green-400' :
        color === 'red' ? 'bg-red-500/15 text-red-400' :
        'bg-gold-500/15 text-gold-400'}`}>
      <Icon className="w-6 h-6" />
    </div>
    <div className="min-w-0">
      <div className="text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-lg font-bold text-slate-900 dark:text-white">{children}</div>
      {sub && <div className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">{sub}</div>}
    </div>
  </div>
);

export default function FinanceDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/finance-dashboard')
      .then(res => setData(res.data.data))
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

  // Aggregate byStatus rows into per-status currency maps
  const agg = { Pending: {}, Paid: {}, Overdue: {} };
  const counts = { Pending: 0, Paid: 0, Overdue: 0 };
  (data?.byStatus || []).forEach(r => {
    const status = r.payment_status;
    if (!agg[status]) { agg[status] = {}; counts[status] = 0; }
    agg[status][r.currency] = (agg[status][r.currency] || 0) + parseFloat(r.total || 0);
    counts[status] += r.count;
  });

  // Outstanding = Pending + Overdue
  const outstanding = {};
  ['Pending', 'Overdue'].forEach(s => {
    Object.entries(agg[s] || {}).forEach(([curr, total]) => {
      outstanding[curr] = (outstanding[curr] || 0) + total;
    });
  });

  const paidThisMonth = {};
  (data?.monthlyPaid || []).forEach(r => {
    paidThisMonth[r.currency] = parseFloat(r.total || 0);
  });
  const paidThisMonthCount = (data?.monthlyPaid || []).reduce((s, r) => s + r.count, 0);

  const overdueList  = data?.overdueInvoices || [];
  const upcomingList = data?.upcomingDue || [];
  const recentList   = data?.recentInvoices || [];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Good morning, {user?.fullName?.split(' ')[0]} 👋
          </h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm mt-0.5">Finance overview — invoices & collections</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => navigate('/bank-accounts')}>
            <BuildingLibraryIcon className="w-4 h-4 inline mr-1.5" />Bank Accounts
          </button>
          <button className="btn-primary" onClick={() => navigate('/invoices')}>
            <PlusIcon className="w-4 h-4 inline mr-1.5" />New Invoice
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={CurrencyDollarIcon} label="Outstanding" color="gold"
          sub={`${counts.Pending + counts.Overdue} unpaid invoices`}
          onClick={() => navigate('/invoices')}>
          <MoneyByCurrency map={outstanding} empty="All settled" />
        </StatCard>
        <StatCard icon={ExclamationTriangleIcon} label="Overdue" color="red"
          sub={`${counts.Overdue} invoice${counts.Overdue !== 1 ? 's' : ''} past due`}
          onClick={() => navigate('/invoices')}>
          <MoneyByCurrency map={agg.Overdue} empty="None" />
        </StatCard>
        <StatCard icon={ClockIcon} label="Pending" color="blue"
          sub={`${counts.Pending} awaiting payment`}>
          <MoneyByCurrency map={agg.Pending} empty="None" />
        </StatCard>
        <StatCard icon={CheckCircleIcon} label="Collected This Month" color="green"
          sub={`${paidThisMonthCount} paid invoice${paidThisMonthCount !== 1 ? 's' : ''}`}>
          <MoneyByCurrency map={paidThisMonth} empty="Nothing yet" />
        </StatCard>
      </div>

      {/* Overdue + Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue invoices */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title flex items-center gap-2">
              <ExclamationTriangleIcon className="w-4 h-4 text-red-400" />
              Overdue Invoices
            </h3>
            {overdueList.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-500 dark:text-red-400 font-medium">
                {overdueList.length}
              </span>
            )}
          </div>
          {overdueList.length > 0 ? (
            <div className="space-y-2">
              {overdueList.map(inv => (
                <div key={inv.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/15 border border-red-100 dark:border-red-900/30 cursor-pointer hover:border-red-300 dark:hover:border-red-700 transition-all"
                  onClick={() => navigate('/invoices')}>
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-gold-600 dark:text-gold-400">{inv.invoice_no}</p>
                    <p className="text-sm text-slate-900 dark:text-white font-medium truncate">{inv.client_name || '—'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{fmt(inv.amount, inv.currency)}</p>
                    <p className="text-xs text-red-500 dark:text-red-400">{inv.days_overdue} day{inv.days_overdue !== 1 ? 's' : ''} overdue</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 dark:text-gray-600 text-sm">
              <CheckCircleIcon className="w-8 h-8 mx-auto mb-2 text-green-400/60" />
              No overdue invoices 🎉
            </div>
          )}
        </div>

        {/* Upcoming due */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title flex items-center gap-2">
              <ClockIcon className="w-4 h-4 text-blue-400" />
              Due This Week
            </h3>
            {upcomingList.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500 dark:text-blue-400 font-medium">
                {upcomingList.length}
              </span>
            )}
          </div>
          {upcomingList.length > 0 ? (
            <div className="space-y-2">
              {upcomingList.map(inv => (
                <div key={inv.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-navy-800/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-navy-800 transition-all"
                  onClick={() => navigate('/invoices')}>
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-gold-600 dark:text-gold-400">{inv.invoice_no}</p>
                    <p className="text-sm text-slate-900 dark:text-white font-medium truncate">{inv.client_name || '—'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{fmt(inv.amount, inv.currency)}</p>
                    <p className="text-xs text-slate-500 dark:text-gray-400">due {new Date(inv.due_date).toLocaleDateString('en-GB')}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 dark:text-gray-600 text-sm">
              Nothing due in the next 7 days
            </div>
          )}
        </div>
      </div>

      {/* Recent invoices */}
      <div className="card">
        <h3 className="section-title mb-4 flex items-center gap-2">
          <DocumentTextIcon className="w-4 h-4" />
          Recently Issued Invoices
        </h3>
        {recentList.length > 0 ? (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Due Date</th>
                  <th className="text-right">Issued</th>
                </tr>
              </thead>
              <tbody>
                {recentList.map(inv => (
                  <tr key={inv.id} className="cursor-pointer" onClick={() => navigate('/invoices')}>
                    <td className="font-mono text-gold-400 text-sm">{inv.invoice_no}</td>
                    <td className="text-slate-900 dark:text-white font-medium">{inv.client_name || '—'}</td>
                    <td><Badge label={inv.payment_status} type="status" /></td>
                    <td className="text-right font-semibold text-slate-900 dark:text-white text-sm">{fmt(inv.amount, inv.currency)}</td>
                    <td className="text-right text-slate-500 dark:text-gray-400 text-xs">
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-GB') : '—'}
                    </td>
                    <td className="text-right text-slate-500 dark:text-gray-400 text-xs">
                      {new Date(inv.created_at).toLocaleDateString('en-GB')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">No invoices yet</div>
        )}
      </div>
    </div>
  );
}

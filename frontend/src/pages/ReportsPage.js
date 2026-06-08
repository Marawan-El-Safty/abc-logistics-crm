import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  TrophyIcon, DocumentTextIcon, CheckCircleIcon,
  BriefcaseIcon, ArrowsRightLeftIcon, ChartBarIcon,
  ArrowDownTrayIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

const COLORS = ['#C85A0A','#2A4A8A','#16a34a','#dc2626','#9333ea','#0891b2','#ca8a04'];
const STATUS_COLOR = {
  Booked:'#6366f1','In Progress':'#f59e0b',Loaded:'#3b82f6',
  Sailed:'#8b5cf6',Arrived:'#10b981',Delivered:'#16a34a',
  'On Hold':'#ef4444',Cancelled:'#6b7280',
};

function ScoreBadge({ score, max }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-slate-400';
  return (
    <div className="flex items-center gap-2 min-w-[130px]">
      <div className="flex-1 h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-700 dark:text-gray-200 w-8 text-right">{score}</span>
    </div>
  );
}

function Tile({ label, value, sub, color = 'slate' }) {
  const cls = {
    green:  'bg-green-50  dark:bg-green-900/20  text-green-700  dark:text-green-400',
    red:    'bg-red-50    dark:bg-red-900/20    text-red-700    dark:text-red-400',
    blue:   'bg-blue-50   dark:bg-blue-900/20   text-blue-700   dark:text-blue-400',
    gold:   'bg-amber-50  dark:bg-amber-900/20  text-amber-700  dark:text-amber-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400',
    slate:  'bg-slate-50  dark:bg-navy-800      text-slate-700  dark:text-gray-300',
  }[color];
  return (
    <div className={`rounded-xl px-4 py-3 ${cls}`}>
      <p className="text-xs opacity-70 mb-0.5">{label}</p>
      <p className="text-2xl font-bold">{value ?? '—'}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-navy-800">
        <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
          <Icon className="w-4 h-4 text-orange-600 dark:text-orange-400" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );
}

const PRESETS = [
  { label: 'This Week',  days: 7   },
  { label: 'This Month', days: 30  },
  { label: '3 Months',   days: 90  },
  { label: 'This Year',  days: 365 },
];

function getRange(days) {
  const to   = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  return { from, to };
}

export default function ReportsPage() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState(30);
  const [from, setFrom]     = useState(() => getRange(30).from);
  const [to, setTo]         = useState(() => getRange(30).to);
  const [custom, setCustom] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/full', { params: { from, to } });
      setData(res.data.data);
    } catch (_) {}
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const applyPreset = (days) => {
    setPreset(days); setCustom(false);
    const r = getRange(days);
    setFrom(r.from); setTo(r.to);
  };

  const maxScore = data ? Math.max(...data.users.map(u => u.score), 1) : 1;

  const downloadCSV = () => {
    if (!data) return;
    const headers = ['Name','Role','Score','Leads Won','Leads Created','Quotations Sent',
      'Quotations Confirmed','Activities','Calls','Meetings','Emails',
      'Tasks Done','Tasks Overdue','Requests Resolved','Shipments Delivered'];
    const rows = data.users.map(u => [
      u.full_name, u.role, u.score, u.leads_won, u.leads_created,
      u.quotations_sent, u.quotations_confirmed, u.activities, u.calls,
      u.meetings, u.emails, u.tasks_done, u.tasks_overdue,
      u.requests_resolved, u.shipments_delivered,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `safty-report-${from}-${to}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const downloadExcel = async (endpoint, filename) => {
    try {
      const res = await api.get(endpoint, {
        params: { from, to },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + date controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Reports & KPIs</h1>
          <p className="page-subtitle">Full team performance · {from} → {to}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESETS.map(p => (
            <button key={p.days} onClick={() => applyPreset(p.days)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                preset === p.days && !custom
                  ? 'bg-gold-500 text-navy-950 font-medium'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}>{p.label}</button>
          ))}
          <button onClick={() => setCustom(v => !v)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
              custom ? 'bg-gold-500 text-navy-950 font-medium'
                     : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-gray-400'}`}>
            Custom
          </button>
          {custom && (
            <>
              <input type="date" className="input text-sm py-1.5 w-36" value={from} onChange={e => setFrom(e.target.value)} />
              <span className="text-slate-400">→</span>
              <input type="date" className="input text-sm py-1.5 w-36" value={to}   onChange={e => setTo(e.target.value)} />
            </>
          )}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-navy-900 rounded-lg">
            <button onClick={downloadCSV} className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-navy-800 rounded-md transition-all" title="Export team performance as CSV">
              <ArrowDownTrayIcon className="w-3.5 h-3.5" />CSV
            </button>
            <button onClick={() => downloadExcel('/reports/export/performance', `performance-${from}-${to}.xlsx`)} className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-navy-800 rounded-md transition-all" title="Export team performance as Excel">
              <ArrowDownTrayIcon className="w-3.5 h-3.5" />Perf.
            </button>
            <button onClick={() => downloadExcel('/reports/export/quotations', `quotations-${from}-${to}.xlsx`)} className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-navy-800 rounded-md transition-all" title="Export quotations as Excel">
              <ArrowDownTrayIcon className="w-3.5 h-3.5" />Quot.
            </button>
            <button onClick={() => downloadExcel('/reports/export/shipments', `shipments-${from}-${to}.xlsx`)} className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-navy-800 rounded-md transition-all" title="Export shipments as Excel">
              <ArrowDownTrayIcon className="w-3.5 h-3.5" />Ships.
            </button>
            <button onClick={() => downloadExcel('/reports/export/invoices', `invoices-${from}-${to}.xlsx`)} className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-navy-800 rounded-md transition-all" title="Export invoices as Excel (Finance/Admin)">
              <ArrowDownTrayIcon className="w-3.5 h-3.5" />Inv.
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-36 rounded-2xl bg-slate-100 dark:bg-navy-800 animate-pulse" />)}
        </div>
      ) : !data ? (
        <p className="text-slate-400 text-center py-20">Failed to load.</p>
      ) : (
        <div className="space-y-6">

          {/* ── 1. LEADERBOARD ─────────────────────────────────────────────── */}
          <Section title="Team Performance Leaderboard" icon={TrophyIcon}>
            {/* Score formula explanation */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 p-3 bg-slate-50 dark:bg-navy-800 rounded-xl text-xs text-slate-500 dark:text-gray-400">
              <span className="font-semibold text-slate-700 dark:text-gray-200 mr-1">Score =</span>
              {Object.entries(data.scoreWeights).map(([k, v]) => (
                <span key={k}><span className="font-semibold text-slate-700 dark:text-gray-200">{v}</span> × {k.replace(/_/g,' ')}</span>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-navy-700 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Role</th>
                    <th className="px-3 py-2 text-left min-w-[140px]">Score</th>
                    <th className="px-3 py-2 text-center">Leads Won</th>
                    <th className="px-3 py-2 text-center">Quot. Sent</th>
                    <th className="px-3 py-2 text-center">Quot. Confirmed</th>
                    <th className="px-3 py-2 text-center">Activities</th>
                    <th className="px-3 py-2 text-center">Tasks ✓</th>
                    <th className="px-3 py-2 text-center">Overdue</th>
                    <th className="px-3 py-2 text-center">Requests ✓</th>
                    <th className="px-3 py-2 text-center">Ships Delivered</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u, i) => (
                    <tr key={u.id}
                      className={`border-b border-slate-100 dark:border-navy-800 hover:bg-amber-50/50 dark:hover:bg-navy-800/60 transition-colors
                        ${i === 0 ? 'bg-amber-50/70 dark:bg-amber-900/10' : ''}`}>
                      <td className="px-3 py-3 font-bold text-slate-500 dark:text-gray-400">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">{u.full_name}</td>
                      <td className="px-3 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-gray-400">{u.role}</span>
                      </td>
                      <td className="px-3 py-3"><ScoreBadge score={u.score} max={maxScore} /></td>
                      <td className="px-3 py-3 text-center font-semibold text-green-600 dark:text-green-400">{u.leads_won || 0}</td>
                      <td className="px-3 py-3 text-center text-slate-600 dark:text-gray-300">{u.quotations_sent || 0}</td>
                      <td className="px-3 py-3 text-center font-semibold text-amber-600 dark:text-amber-400">{u.quotations_confirmed || 0}</td>
                      <td className="px-3 py-3 text-center text-slate-600 dark:text-gray-300">{u.activities || 0}</td>
                      <td className="px-3 py-3 text-center text-blue-600 dark:text-blue-400">{u.tasks_done || 0}</td>
                      <td className="px-3 py-3 text-center">
                        {parseInt(u.tasks_overdue) > 0
                          ? <span className="text-red-500 font-bold">{u.tasks_overdue}</span>
                          : <span className="text-slate-300 dark:text-navy-700">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-600 dark:text-gray-300">{u.requests_resolved || 0}</td>
                      <td className="px-3 py-3 text-center text-slate-600 dark:text-gray-300">{u.shipments_delivered || 0}</td>
                    </tr>
                  ))}
                  {!data.users.length && (
                    <tr><td colSpan={12} className="text-center py-10 text-slate-400 dark:text-gray-600">No user data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          {/* ── 2. SALES ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section title="Quotations by Status" icon={DocumentTextIcon}>
              {data.quotationsByStatus.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {data.quotationsByStatus.map(q => (
                    <Tile key={q.status} label={q.status} value={q.count}
                      sub={`$${parseFloat(q.total_value||0).toLocaleString('en-US',{maximumFractionDigits:0})} value`}
                      color={q.status==='Confirmed'?'green':q.status==='Rejected'?'red':q.status==='Sent'?'blue':'slate'} />
                  ))}
                </div>
              ) : <p className="text-slate-400 dark:text-gray-600 text-sm text-center py-8">No quotations in this period</p>}
            </Section>

            <Section title="Activity Breakdown by Rep" icon={ChartBarIcon}>
              {data.users.filter(u => parseInt(u.activities) > 0).length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.users.filter(u => parseInt(u.activities) > 0).slice(0, 8)}
                    margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="full_name" tick={{ fontSize: 10 }} tickFormatter={n => n.split(' ')[0]} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="calls"    name="Calls"    fill="#3b82f6" stackId="a" />
                    <Bar dataKey="meetings" name="Meetings" fill="#8b5cf6" stackId="a" />
                    <Bar dataKey="emails"   name="Emails"   fill="#10b981" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-slate-400 dark:text-gray-600 text-sm text-center py-8">No activities in this period</p>}
            </Section>
          </div>

          {/* ── 3. OPERATIONS ────────────────────────────────────────────── */}
          <Section title="Operations & Shipments" icon={ArrowsRightLeftIcon}>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
              <Tile label="Total Shipments" value={data.operations.total_shipments} color="blue" />
              <Tile label="Export"          value={data.operations.exports}         color="gold" />
              <Tile label="Import"          value={data.operations.imports}         color="purple" />
              <Tile label="Domestic"        value={data.operations.domestic}        color="slate" />
              <Tile label="Delivered"       value={data.operations.delivered}       color="green" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide mb-3">By Status (all time)</p>
                {data.shipmentsByStatus.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.shipmentsByStatus} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="status" type="category" tick={{ fontSize: 10 }} width={90} />
                      <Tooltip />
                      <Bar dataKey="count" name="Shipments" radius={[0,4,4,0]}>
                        {data.shipmentsByStatus.map((s, i) => (
                          <Cell key={i} fill={STATUS_COLOR[s.status] || COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-slate-400 text-sm text-center py-6">No data</p>}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide mb-3">By Direction</p>
                {data.shipmentsByDirection.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={data.shipmentsByDirection} dataKey="count" nameKey="direction"
                        cx="50%" cy="50%" outerRadius={75}
                        label={({ direction, percent }) => `${direction} ${(percent*100).toFixed(0)}%`}
                        labelLine={false}>
                        {data.shipmentsByDirection.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-slate-400 text-sm text-center py-6">No data</p>}
              </div>
            </div>
          </Section>

          {/* ── 4. TASKS ─────────────────────────────────────────────────── */}
          <Section title="Tasks Overview" icon={CheckCircleIcon}>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
              <Tile label="Total Tasks"  value={data.tasks.total}       color="blue" />
              <Tile label="Done"         value={data.tasks.done}        color="green" />
              <Tile label="In Progress"  value={data.tasks.in_progress} color="gold" />
              <Tile label="Pending"      value={data.tasks.pending}     color="slate" />
              <Tile label="Overdue"      value={data.tasks.overdue}     color="red"
                sub={parseInt(data.tasks.overdue) > 0 ? '⚠️ Needs attention' : '✅ All on track'} />
            </div>
            {data.tasksByUser.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-navy-700 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                      {['Name','Role','Done','In Progress','Pending','Overdue'].map(h => (
                        <th key={h} className="px-3 py-2 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.tasksByUser.map((u, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-navy-800">
                        <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-gray-200">{u.full_name}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-gray-400">{u.role}</td>
                        <td className="px-3 py-2.5 text-green-600 dark:text-green-400 font-semibold">{u.done}</td>
                        <td className="px-3 py-2.5 text-amber-600 dark:text-amber-400">{u.in_progress}</td>
                        <td className="px-3 py-2.5 text-slate-500 dark:text-gray-400">{u.pending}</td>
                        <td className="px-3 py-2.5">
                          {parseInt(u.overdue) > 0
                            ? <span className="flex items-center gap-1 text-red-500 font-bold"><ExclamationTriangleIcon className="w-3 h-3" />{u.overdue}</span>
                            : <span className="text-slate-300 dark:text-navy-700">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* ── 5. REQUESTS ──────────────────────────────────────────────── */}
          <Section title="Open Requests" icon={BriefcaseIcon}>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
              <Tile label="Total"        value={data.requests.total}       color="blue" />
              <Tile label="Open"         value={data.requests.open}        color="gold" />
              <Tile label="In Progress"  value={data.requests.in_progress} color="purple" />
              <Tile label="Closed"       value={data.requests.closed}      color="green" />
              <Tile label="Urgent Open"  value={data.requests.urgent_open} color="red"
                sub={data.requests.avg_resolution_hours
                  ? `Avg ${data.requests.avg_resolution_hours}h to resolve` : null} />
            </div>
            {data.requestsByUser.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-navy-700 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                      {['Assignee','Resolved','Open','Total'].map(h => (
                        <th key={h} className="px-3 py-2 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.requestsByUser.map((u, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-navy-800">
                        <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-gray-200">{u.full_name}</td>
                        <td className="px-3 py-2.5 text-green-600 dark:text-green-400 font-semibold">{u.resolved}</td>
                        <td className="px-3 py-2.5 text-amber-600 dark:text-amber-400">{u.open}</td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-gray-400">{u.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

        </div>
      )}
    </div>
  );
}

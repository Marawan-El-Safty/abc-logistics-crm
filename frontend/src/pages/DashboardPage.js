import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { useTheme } from '../store/ThemeContext';
import api from '../services/api';
import {
  UserGroupIcon, FunnelIcon, DocumentTextIcon, CheckCircleIcon,
  BriefcaseIcon, BellAlertIcon, PlusIcon, ClipboardDocumentListIcon,
  MapPinIcon, TrophyIcon
} from '@heroicons/react/24/outline';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import Badge from '../components/common/Badge';
import { formatDistanceToNow } from 'date-fns';
import FinanceDashboard from './FinanceDashboard';
import OperationDashboard from './OperationDashboard';

const STAGE_COLORS = {
  'New Lead': '#3b82f6',
  'Contacted': '#f59e0b',
  'Proposal Sent': '#8b5cf6',
  'Negotiating': '#C9A84C',
  'Won': '#10b981',
  'Lost': '#ef4444',
};

const StatCard = ({ icon: Icon, label, value, color = 'gold', onClick }) => (
  <div
    className={`card flex items-center gap-4 ${onClick ? 'cursor-pointer hover:border-gold-500/50 transition-all' : ''}`}
    onClick={onClick}
  >
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
      ${color === 'gold' ? 'bg-gold-500/15 text-gold-400' :
        color === 'blue' ? 'bg-blue-500/15 text-blue-400' :
        color === 'green' ? 'bg-green-500/15 text-green-400' :
        color === 'red' ? 'bg-red-500/15 text-red-400' :
        'bg-purple-500/15 text-purple-400'}`}>
      <Icon className="w-6 h-6" />
    </div>
    <div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white">{value ?? '—'}</div>
      <div className="text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide">{label}</div>
    </div>
  </div>
);

export default function DashboardPage() {
  const { user, canManage, isFinance, isOperation } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const chartGrid = theme === 'dark' ? '#1e3a5f' : '#e2e8f0';
  const chartTick = theme === 'dark' ? '#9ca3af' : '#64748b';
  const chartTooltip = theme === 'dark'
    ? { background: '#0d2144', border: '1px solid #1e3a5f', borderRadius: 8, color: '#fff' }
    : { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b' };

  useEffect(() => {
    if (isFinance || isOperation) { setLoading(false); return; }
    api.get('/reports/dashboard')
      .then(res => setData(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isFinance, isOperation]);

  // Finance and Operation each get a focused dashboard, not the sales pipeline
  if (isFinance) return <FinanceDashboard />;
  if (isOperation) return <OperationDashboard />;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex gap-1.5">
        {[0,1,2].map(i => (
          <div key={i} className="w-2 h-2 bg-gold-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );

  const stats = data?.wonLostStats || {};
  const convRate = stats.total > 0 ? ((stats.won / stats.total) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Good morning, {user?.fullName?.split(' ')[0]} 👋</h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm mt-0.5">Here's what's happening at ABC Logistics today</p>
        </div>
        <div className="flex gap-2">
          <a
            href="https://www.linescape.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
              bg-blue-500/15 text-blue-400 border border-blue-500/30
              hover:bg-blue-500/25 hover:border-blue-400/60 hover:text-blue-300
              transition-all duration-200"
            title="Track vessel routes and schedules on Linescape"
          >
            <MapPinIcon className="w-4 h-4 flex-shrink-0" />
            Track Vessel
          </a>
          <button className="btn-secondary" onClick={() => navigate('/leads')}>
            <PlusIcon className="w-4 h-4 inline mr-1.5" />Add Lead
          </button>
          <button className="btn-primary" onClick={() => navigate('/quotations/new')}>
            <PlusIcon className="w-4 h-4 inline mr-1.5" />New Quotation
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={UserGroupIcon} label="Active Leads" value={stats.active} color="blue" onClick={() => navigate('/leads')} />
        <StatCard icon={FunnelIcon} label="Won Deals" value={stats.won} color="green" />
        <StatCard icon={TrophyIcon} label="Won Quotations" value={data?.wonQuotationsCount} color="gold" onClick={() => navigate('/quotations')} />
        <StatCard icon={BellAlertIcon} label="Follow-ups Today" value={data?.todayFollowUpsCount} color="gold" onClick={() => navigate('/activities')} />
        {!isFinance && (
          <StatCard icon={BriefcaseIcon} label="Open Requests" value={data?.openRequestsCount} color="red" onClick={() => navigate('/requests')} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Chart */}
        <div className="card lg:col-span-2">
          <h3 className="section-title mb-4">Pipeline by Stage</h3>
          {data?.leadsByStage?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.leadsByStage}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                <XAxis dataKey="stage" tick={{ fill: chartTick, fontSize: 11 }} />
                <YAxis tick={{ fill: chartTick, fontSize: 11 }} />
                <Tooltip contentStyle={chartTooltip} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.leadsByStage.map((entry, index) => (
                    <Cell key={index} fill={STAGE_COLORS[entry.stage] || '#C9A84C'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500">No pipeline data</div>
          )}
        </div>

        {/* Win/Loss Pie */}
        <div className="card">
          <h3 className="section-title mb-4">Win / Loss Ratio</h3>
          <div className="flex items-center justify-center">
            <PieChart width={160} height={160}>
              <Pie
                data={[
                  { name: 'Won', value: parseInt(stats.won) || 0 },
                  { name: 'Lost', value: parseInt(stats.lost) || 0 },
                  { name: 'Active', value: parseInt(stats.active) || 0 },
                ]}
                cx={75} cy={75} innerRadius={45} outerRadius={70}
                dataKey="value"
              >
                <Cell fill="#10b981" />
                <Cell fill="#ef4444" />
                <Cell fill="#3b82f6" />
              </Pie>
            </PieChart>
          </div>
          <div className="space-y-2 mt-2">
            {[
              { label: 'Won', value: stats.won, color: 'text-green-400' },
              { label: 'Lost', value: stats.lost, color: 'text-red-400' },
              { label: 'Active', value: stats.active, color: 'text-blue-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between items-center text-sm">
                <span className="text-slate-500 dark:text-gray-400">{label}</span>
                <span className={`font-semibold ${color}`}>{value || 0}</span>
              </div>
            ))}
            <div className="flex justify-between items-center text-sm pt-1 border-t border-slate-200 dark:border-navy-700">
              <span className="text-slate-500 dark:text-gray-400">Conversion Rate</span>
              <span className="font-semibold text-gold-600 dark:text-gold-400">{convRate}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Manager KPIs */}
      {canManage && data?.repKpis?.length > 0 && (
        <div className="card">
          <h3 className="section-title mb-4">Team Performance (Last 30 Days)</h3>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Sales Rep</th>
                  <th>Won Deals</th>
                  <th>Total Leads</th>
                  <th>Activities</th>
                  <th>Conversion Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.repKpis.map((rep) => (
                  <tr key={rep.id}>
                    <td className="font-medium text-slate-900 dark:text-white">{rep.full_name}</td>
                    <td><span className="text-green-400 font-semibold">{rep.won_deals || 0}</span></td>
                    <td>{rep.total_leads || 0}</td>
                    <td>{rep.activity_count || 0}</td>
                    <td>
                      <span className="text-gold-400 font-semibold">{rep.conversion_rate || 0}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Revenue Over Time + Lead Source */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <h3 className="section-title mb-4">Revenue (Last 6 Months)</h3>
          {data?.revenueOverTime?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.revenueOverTime} margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                <XAxis dataKey="month" tick={{ fill: chartTick, fontSize: 11 }} />
                <YAxis tick={{ fill: chartTick, fontSize: 11 }} />
                <Tooltip contentStyle={chartTooltip} formatter={(v) => `$${Number(v).toLocaleString()}`} />
                <Legend />
                <Line type="monotone" dataKey="usd" name="USD" stroke="#C9A84C" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="egp" name="EGP" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500 text-sm">No paid invoices in the last 6 months</div>
          )}
        </div>

        <div className="card">
          <h3 className="section-title mb-4">Lead Sources</h3>
          {data?.leadsBySource?.length > 0 ? (
            <>
              <div className="flex items-center justify-center">
                <PieChart width={150} height={150}>
                  <Pie
                    data={data.leadsBySource}
                    dataKey="count"
                    nameKey="source"
                    cx={72} cy={72} innerRadius={38} outerRadius={62}
                  >
                    {data.leadsBySource.map((_, i) => (
                      <Cell key={i} fill={['#C9A84C','#3b82f6','#10b981','#8b5cf6','#ef4444','#f59e0b'][i % 6]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </div>
              <div className="space-y-1.5 mt-1">
                {data.leadsBySource.map((s, i) => (
                  <div key={s.source} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ['#C9A84C','#3b82f6','#10b981','#8b5cf6','#ef4444','#f59e0b'][i % 6] }} />
                      <span className="text-slate-500 dark:text-gray-400">{s.source}</span>
                    </div>
                    <span className="font-semibold text-slate-700 dark:text-gray-200">{s.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-500 text-sm">No lead data</div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h3 className="section-title mb-4">Recent Activity</h3>
        {data?.recentActivity?.length > 0 ? (
          <div className="space-y-3">
            {data.recentActivity.map((act) => (
              <div key={act.id} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-navy-800/50 rounded-lg">
                <div className="w-8 h-8 rounded-lg bg-gold-500/15 flex items-center justify-center text-gold-500 dark:text-gold-400 flex-shrink-0">
                  <ClipboardDocumentListIcon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-900 dark:text-white text-sm font-medium">{act.performed_by_name}</span>
                    <Badge label={act.activity_type} />
                    <span className="text-slate-500 dark:text-gray-400 text-sm">with</span>
                    <span className="text-gold-600 dark:text-gold-400 text-sm">{act.client_name || act.lead_company || 'Unknown'}</span>
                  </div>
                  {act.notes && <p className="text-slate-500 dark:text-gray-400 text-xs mt-1 line-clamp-1">{act.notes}</p>}
                </div>
                <span className="text-slate-500 dark:text-gray-500 text-xs flex-shrink-0">
                  {formatDistanceToNow(new Date(act.activity_date), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8 text-sm">No recent activities</div>
        )}
      </div>
    </div>
  );
}

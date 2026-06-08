import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import Badge from '../components/common/Badge';
import {
  ArrowTrendingUpIcon, ArrowTrendingDownIcon, BanknotesIcon,
  ScaleIcon, CurrencyDollarIcon
} from '@heroicons/react/24/outline';

const INV_STATUSES = ['Pending', 'Paid', 'Overdue'];

function StatCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <p className="text-slate-500 dark:text-gray-400 text-xs mb-0.5">{label}</p>
        <div className="text-slate-900 dark:text-white font-bold text-xl leading-tight">{value}</div>
        {sub && <p className="text-slate-500 dark:text-gray-500 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function fmt(n, currency = 'USD') {
  return `${currency} ${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

// Transform a {currency: {...}} map into {currency: number} using a selector
const mapVals = (obj, fn) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v)]));

// Render a per-currency money breakdown ("USD 1,200.00" stacked per currency)
function MoneyLines({ map, empty = '—' }) {
  const entries = Object.entries(map || {}).filter(([, v]) => Math.abs(v) > 0.005);
  if (!entries.length) return <span className="text-base">{empty}</span>;
  return (
    <div className="flex flex-col leading-tight">
      {entries.map(([cur, val]) => (
        <span key={cur} className={`${entries.length > 1 ? 'text-base' : 'text-xl'} font-bold`}>
          {fmt(val, cur)}
        </span>
      ))}
    </div>
  );
}

export default function ProfitPage() {
  const [invoices, setInvoices] = useState([]);
  const [status, setStatus]    = useState('');
  const [loading, setLoading]  = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/invoices', { params: { paymentStatus: status || undefined } });
      setInvoices(res.data.data || []);
    } catch (_) {}
    finally { setLoading(false); }
  }, [status]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  // Only invoices that have buying cost entered
  const withCost    = invoices.filter(i => parseFloat(i.buying_total || 0) > 0);
  const withoutCost = invoices.filter(i => !(parseFloat(i.buying_total || 0) > 0));
  const paidWithCost = withCost.filter(i => i.payment_status === 'Paid');

  // Aggregate per currency — USD/EUR/EGP cannot be summed into one number
  const byCurrency = {};
  withCost.forEach(i => {
    const c = i.currency || 'USD';
    if (!byCurrency[c]) byCurrency[c] = { selling: 0, buying: 0, paidSelling: 0, paidBuying: 0 };
    const sell = parseFloat(i.amount || 0);
    const buy  = parseFloat(i.buying_total || 0);
    byCurrency[c].selling += sell;
    byCurrency[c].buying  += buy;
    if (i.payment_status === 'Paid') {
      byCurrency[c].paidSelling += sell;
      byCurrency[c].paidBuying  += buy;
    }
  });

  const sellingByCur   = mapVals(byCurrency, v => v.selling);
  const buyingByCur    = mapVals(byCurrency, v => v.buying);
  const profitByCur    = mapVals(byCurrency, v => v.paidSelling - v.paidBuying); // confirmed (paid) profit
  // Avg margin = simple mean of each currency's margin (ratios are unitless)
  const marginsPerCur  = Object.values(byCurrency)
    .filter(v => v.selling > 0)
    .map(v => ((v.selling - v.buying) / v.selling) * 100);
  const avgMargin = marginsPerCur.length
    ? marginsPerCur.reduce((s, m) => s + m, 0) / marginsPerCur.length : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Profit & Margin</h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm">
            Confirmed revenue, costs, and profit from invoices
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Invoiced"
          value={<MoneyLines map={sellingByCur} empty="—" />}
          sub={`${withCost.length} with cost data`}
          icon={BanknotesIcon}
          color="bg-blue-500/15 text-blue-400"
        />
        <StatCard
          label="Total Cost"
          value={<MoneyLines map={buyingByCur} empty="—" />}
          sub="buying prices"
          icon={ArrowTrendingDownIcon}
          color="bg-orange-500/15 text-orange-400"
        />
        <StatCard
          label="Confirmed Profit"
          value={<MoneyLines map={profitByCur} empty="—" />}
          sub={`from ${paidWithCost.length} paid invoice${paidWithCost.length !== 1 ? 's' : ''}`}
          icon={ArrowTrendingUpIcon}
          color="bg-green-500/15 text-green-400"
        />
        <StatCard
          label="Avg Margin"
          value={`${avgMargin.toFixed(1)}%`}
          sub="across invoiced"
          icon={ScaleIcon}
          color={avgMargin >= 20 ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'}
        />
      </div>

      {/* Sub-header + filter */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <p className="text-slate-500 dark:text-gray-400 text-sm">
          {withCost.length} invoice{withCost.length !== 1 ? 's' : ''} with cost data
          {withoutCost.length > 0 && (
            <span className="text-orange-400"> · {withoutCost.length} pending cost entry</span>
          )}
        </p>
        <div className="flex gap-2">
          {['', ...INV_STATUSES].map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                status === s
                  ? 'bg-gold-500 text-navy-950 font-medium'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-500">Loading...</div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Client</th>
                <th>Description</th>
                <th>Created By</th>
                <th>Status</th>
                <th className="text-right">Selling</th>
                <th className="text-right">Buying (Cost)</th>
                <th className="text-right">Profit</th>
                <th className="text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const selling = parseFloat(inv.amount || 0);
                const buying  = parseFloat(inv.buying_total || 0);
                const profit  = selling - buying;
                const margin  = selling > 0 && buying > 0 ? (profit / selling) * 100 : null;
                const hasCost = buying > 0;

                return (
                  <tr key={inv.id}>
                    <td className="font-mono text-gold-400 text-sm">{inv.invoice_no}</td>
                    <td className="text-slate-900 dark:text-white font-medium">{inv.client_name || '—'}</td>
                    <td className="text-gray-400 text-sm max-w-xs truncate">{inv.description || '—'}</td>
                    <td className="text-slate-500 dark:text-gray-400 text-xs">{inv.created_by_name || '—'}</td>
                    <td><Badge label={inv.payment_status} type="status" /></td>
                    <td className="text-right font-semibold text-slate-900 dark:text-white text-sm">
                      {fmt(selling, inv.currency)}
                    </td>
                    <td className="text-right text-sm">
                      {hasCost
                        ? <span className="text-orange-400">{fmt(buying, inv.currency)}</span>
                        : <span className="text-gray-600 text-xs">— not entered</span>}
                    </td>
                    <td className="text-right font-bold text-sm">
                      {hasCost
                        ? <span className={profit >= 0 ? 'text-green-400' : 'text-red-400'}>{fmt(profit, inv.currency)}</span>
                        : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="text-right text-sm">
                      {margin !== null ? (
                        <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${
                          margin >= 20 ? 'bg-green-500/15 text-green-400' :
                          margin >= 10 ? 'bg-yellow-500/15 text-yellow-400' :
                          margin >= 0  ? 'bg-orange-500/15 text-orange-400' :
                                         'bg-red-500/15 text-red-400'
                        }`}>
                          {margin.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!invoices.length && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-500">
                    <CurrencyDollarIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    No invoices found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

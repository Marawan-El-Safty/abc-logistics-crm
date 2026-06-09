import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import {
  PlusIcon, DocumentArrowDownIcon, TrashIcon, PencilIcon,
  TableCellsIcon, FunnelIcon,
} from '@heroicons/react/24/outline';
import Badge from '../components/common/Badge';
import { TableSkeleton } from '../components/common/Skeleton';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useAuth } from '../store/AuthContext';

const STATUSES = ['Draft', 'Pending Review', 'Approved', 'Sent', 'Confirmed', 'Rejected'];

const STATUS_BADGE = {
  Draft:          'default',
  'Pending Review': 'warning',
  Approved:       'success',
  Sent:           'info',
  Confirmed:      'success',
  Rejected:       'danger',
};

export default function ComparisonsPage() {
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatus]   = useState('');
  const [deleteTarget, setDelete]   = useState(null);
  const [pdfLoading, setPdfLoading] = useState(null);
  const navigate  = useNavigate();
  const { canManage, isAdmin, isRep, isFinance } = useAuth();

  const APPROVED = ['Approved', 'Sent', 'Confirmed'];
  const canPdf = (q) => !(isRep || isFinance) || APPROVED.includes(q.status);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/quotations', { params: { limit: 200 } });
      const all = res.data.data || [];
      const comparisons = all.filter(q => Array.isArray(q.options) && q.options.length > 1);
      const filtered = statusFilter ? comparisons.filter(q => q.status === statusFilter) : comparisons;
      setItems(filtered);
    } catch {
      toast.error('Failed to load comparisons');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    try {
      await api.delete(`/quotations/${deleteTarget.id}`);
      toast.success('Deleted');
      setDelete(null);
      load();
    } catch {
      toast.error('Delete failed');
    }
  };

  const handlePdf = async (q) => {
    setPdfLoading(q.id);
    try {
      const res = await api.get(`/quotations/${q.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch {
      toast.error('PDF generation failed');
    } finally {
      setPdfLoading(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-navy-800 flex items-center justify-center">
            <TableCellsIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Comparison Quotations</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Multi-option S/L comparisons for clients</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/quotations/new?mode=comparison')}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 dark:bg-navy-700 text-white text-sm font-medium rounded-lg hover:bg-slate-700 dark:hover:bg-navy-600 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          New Comparison
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <FunnelIcon className="w-4 h-4 text-slate-400" />
        <select
          value={statusFilter}
          onChange={e => setStatus(e.target.value)}
          className="text-sm border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-1.5 bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-navy-600"
        >
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs text-slate-400">{items.length} comparison{items.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : items.length === 0 ? (
        <div className="text-center py-24 text-slate-400 dark:text-slate-600">
          <TableCellsIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No comparison quotations yet</p>
          <p className="text-sm mt-1">Create one to compare shipping line options for your clients.</p>
          <button
            onClick={() => navigate('/quotations/new?mode=comparison')}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-800 dark:bg-navy-700 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            New Comparison
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-navy-800 border-b border-slate-200 dark:border-navy-700">
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Ref</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Client</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Route</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Options</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Date</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
              {items.map(q => (
                <tr
                  key={q.id}
                  className="hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/quotations/${q.id}/edit`)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {q.ref_number || `#${q.id}`}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {q.client_name || q.lead_name || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {q.origin && q.destination ? `${q.origin} → ${q.destination}` : q.service_type || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(q.options || []).map((opt, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-300"
                        >
                          {opt.label || `Option ${String.fromCharCode(65 + i)}`}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={q.status} type={STATUS_BADGE[q.status] || 'default'} />
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                    {q.created_at ? new Date(q.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      {canPdf(q) && (
                        <button
                          onClick={() => handlePdf(q)}
                          disabled={pdfLoading === q.id}
                          title="Download PDF"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors disabled:opacity-40"
                        >
                          <DocumentArrowDownIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/quotations/${q.id}/edit`)}
                        title="Edit"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      {canManage && (
                        <button
                          onClick={() => setDelete(q)}
                          title="Delete"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Comparison"
        message={`Delete comparison ${deleteTarget?.ref_number || `#${deleteTarget?.id}`}? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDelete(null)}
      />
    </div>
  );
}
